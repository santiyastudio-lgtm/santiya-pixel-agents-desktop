const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const CODEX_ROOT = path.join(os.homedir(), '.codex');
const SESSION_INDEX_PATH = path.join(CODEX_ROOT, 'session_index.jsonl');
const SESSIONS_ROOT = path.join(CODEX_ROOT, 'sessions');
const ARCHIVED_ROOT = path.join(CODEX_ROOT, 'archived_sessions');
const ACTIVE_WINDOW_MS = 90 * 1000;
const WAITING_WINDOW_MS = 10 * 60 * 1000;
const MAX_LINES = 1600;

function safeReadFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

function safeStat(filePath) {
  try {
    return fs.statSync(filePath);
  } catch {
    return null;
  }
}

function parseJsonLines(filePath) {
  const raw = safeReadFile(filePath);
  if (!raw) return [];
  const lines = raw.split(/\r?\n/).filter(Boolean);
  const start = Math.max(0, lines.length - MAX_LINES);
  const parsed = [];
  for (let index = start; index < lines.length; index++) {
    try {
      parsed.push(JSON.parse(lines[index]));
    } catch {
      // Ignore malformed lines.
    }
  }
  return parsed;
}

function normalizeThreadName(value, fallback) {
  if (!value || typeof value !== 'string') return fallback;
  return value;
}

function listRolloutFiles(rootDir, archived) {
  if (!fs.existsSync(rootDir)) return [];
  const out = [];
  const stack = [rootDir];
  while (stack.length > 0) {
    const current = stack.pop();
    let entries = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith('.jsonl') || !entry.name.startsWith('rollout-')) {
        continue;
      }
      const match = entry.name.match(
        /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jsonl$/i,
      );
      if (!match) continue;
      const stat = safeStat(fullPath);
      out.push({
        threadId: match[1],
        filePath: fullPath,
        archived,
        mtimeMs: stat ? stat.mtimeMs : 0,
      });
    }
  }
  return out;
}

function readThreadIndex() {
  if (!fs.existsSync(SESSION_INDEX_PATH)) return [];
  const lines = safeReadFile(SESSION_INDEX_PATH)?.split(/\r?\n/).filter(Boolean) ?? [];
  const entries = [];
  for (const line of lines) {
    try {
      const item = JSON.parse(line);
      if (!item || typeof item.id !== 'string') continue;
      entries.push({
        threadId: item.id,
        title: normalizeThreadName(item.thread_name, `Thread ${item.id.slice(0, 8)}`),
        updatedAt: typeof item.updated_at === 'string' ? item.updated_at : null,
      });
    } catch {
      // Ignore invalid lines.
    }
  }
  return entries;
}

function buildFileIndex() {
  const byThread = new Map();
  const allFiles = [
    ...listRolloutFiles(SESSIONS_ROOT, false),
    ...listRolloutFiles(ARCHIVED_ROOT, true),
  ];
  for (const file of allFiles) {
    const existing = byThread.get(file.threadId);
    if (!existing || existing.mtimeMs < file.mtimeMs) {
      byThread.set(file.threadId, file);
    }
  }
  return byThread;
}

function toolLabelFromFunctionName(name) {
  switch (name) {
    case 'shell_command':
      return 'Shell';
    case 'apply_patch':
      return 'Patch';
    case 'spawn_agent':
      return 'Spawn agent';
    case 'wait_agent':
      return 'Wait agent';
    case 'open':
      return 'Open';
    case 'click':
      return 'Click';
    case 'find':
      return 'Find';
    case 'search_query':
      return 'Search';
    default:
      return name;
  }
}

function summarizeSubagentPrompt(prompt) {
  if (!prompt || typeof prompt !== 'string') return 'Subagent';
  const line = prompt.split(/\r?\n/).find((value) => value.trim().length > 0) ?? prompt;
  return line.trim().slice(0, 48);
}

function safeParseJson(value) {
  if (typeof value !== 'string') return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function deriveThreadState(threadMeta, fileRecord) {
  const threadId = threadMeta.threadId;
  const parsed = fileRecord ? parseJsonLines(fileRecord.filePath) : [];
  const currentTime = Date.now();
  const activeTools = new Map();
  const activeSubagents = new Map();
  let lastActivityTs = fileRecord?.mtimeMs ?? 0;
  let latestWaitingTs = 0;
  let latestTaskCompleteTs = 0;

  for (const entry of parsed) {
    const timestamp = entry?.timestamp ? Date.parse(entry.timestamp) : 0;
    if (timestamp && timestamp > lastActivityTs) {
      lastActivityTs = timestamp;
    }

    if (entry?.type === 'response_item' && entry?.payload?.type === 'function_call') {
      const callId = entry.payload.call_id;
      const functionName = entry.payload.name;
      if (typeof callId === 'string' && typeof functionName === 'string') {
        activeTools.set(callId, {
          toolId: callId,
          toolName: toolLabelFromFunctionName(functionName),
          status: functionName,
          startedAt: timestamp,
        });
      }

      if (functionName === 'request_user_input') {
        latestWaitingTs = Math.max(latestWaitingTs, timestamp);
      }
    }

    if (entry?.type === 'response_item' && entry?.payload?.type === 'function_call_output') {
      if (typeof entry.payload.call_id === 'string') {
        activeTools.delete(entry.payload.call_id);
      }
    }

    if (entry?.type === 'event_msg') {
      const payloadType = entry.payload?.type;
      if (payloadType === 'task_complete') {
        latestTaskCompleteTs = Math.max(latestTaskCompleteTs, timestamp);
      }
      if (payloadType === 'collab_agent_spawn_end') {
        const newThreadId = entry.payload?.new_thread_id;
        if (typeof newThreadId === 'string') {
          activeSubagents.set(newThreadId, {
            agentId: newThreadId,
            role: 'subagent',
            label:
              entry.payload?.receiver_agent_nickname ||
              entry.payload?.new_agent_nickname ||
              'Subagent',
            prompt: summarizeSubagentPrompt(entry.payload?.prompt),
            status: 'active',
          });
        }
      }
      if (payloadType === 'collab_close_end') {
        const receiverThreadId = entry.payload?.receiver_thread_id;
        if (typeof receiverThreadId === 'string') {
          activeSubagents.delete(receiverThreadId);
        }
      }
      if (payloadType === 'agent_message') {
        latestWaitingTs = Math.max(latestWaitingTs, 0);
      }
    }
  }

  let primaryStatus = 'idle';
  if (latestWaitingTs > latestTaskCompleteTs && currentTime - latestWaitingTs < WAITING_WINDOW_MS) {
    primaryStatus = 'waiting';
  } else if (
    activeTools.size > 0 ||
    (lastActivityTs > 0 && currentTime - lastActivityTs < ACTIVE_WINDOW_MS)
  ) {
    primaryStatus = 'active';
  }

  const tools = [...activeTools.values()]
    .sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0))
    .map((tool) => ({
      toolId: tool.toolId,
      toolName: tool.toolName,
      status: tool.status,
    }));

  const agents = [
    {
      agentId: 'primary',
      role: 'primary',
      label: 'Codex',
      status: primaryStatus,
      tools,
    },
    ...[...activeSubagents.values()].map((subagent) => ({
      agentId: subagent.agentId,
      role: 'subagent',
      label: subagent.label,
      status: subagent.status,
      tools: [
        {
          toolId: `${subagent.agentId}:prompt`,
          toolName: 'Delegated task',
          status: subagent.prompt,
        },
      ],
    })),
  ];

  return {
    threadId,
    title: threadMeta.title,
    archived: !!threadMeta.archived,
    createdAt: threadMeta.createdAt,
    lastActiveAt: threadMeta.lastActiveAt,
    sessionFilePath: fileRecord?.filePath ?? null,
    agents,
  };
}

function getRuntimeSnapshot() {
  const threadIndex = readThreadIndex();
  const fileIndex = buildFileIndex();
  const threadMap = new Map();

  for (const entry of threadIndex) {
    threadMap.set(entry.threadId, {
      threadId: entry.threadId,
      title: entry.title,
      archived: false,
      createdAt: null,
      lastActiveAt: entry.updatedAt,
    });
  }

  for (const [threadId, fileRecord] of fileIndex.entries()) {
    if (!threadMap.has(threadId)) {
      threadMap.set(threadId, {
        threadId,
        title: `Thread ${threadId.slice(0, 8)}`,
        archived: fileRecord.archived,
        createdAt: null,
        lastActiveAt: new Date(fileRecord.mtimeMs).toISOString(),
      });
    } else if (fileRecord.archived) {
      threadMap.get(threadId).archived = true;
    }
  }

  const threads = [...threadMap.values()]
    .map((thread) => {
      const fileRecord = fileIndex.get(thread.threadId);
      return {
        ...thread,
        archived: fileRecord ? fileRecord.archived : thread.archived,
        lastActiveAt:
          thread.lastActiveAt || (fileRecord ? new Date(fileRecord.mtimeMs).toISOString() : null),
      };
    })
    .sort((a, b) => {
      const aTime = a.lastActiveAt ? Date.parse(a.lastActiveAt) : 0;
      const bTime = b.lastActiveAt ? Date.parse(b.lastActiveAt) : 0;
      return bTime - aTime;
    });

  const envThreadId = process.env.CODEX_THREAD_ID || null;
  const freshestThreadId = threads[0]?.threadId || null;
  const currentThreadId =
    freshestThreadId ||
    threads.find((thread) => thread.threadId === envThreadId)?.threadId ||
    null;
  return {
    mode: threads.length > 0 ? 'codexDesktopLive' : 'demo',
    currentThreadId,
    threads,
    fileIndex,
  };
}

function getThreadsResponse() {
  const snapshot = getRuntimeSnapshot();
  return {
    mode: snapshot.mode,
    currentThreadId: snapshot.currentThreadId,
    threads: snapshot.threads.map((thread) => ({
      threadId: thread.threadId,
      title: thread.title,
      archived: thread.archived,
      createdAt: thread.createdAt,
      lastActiveAt: thread.lastActiveAt,
    })),
  };
}

function getThreadStateResponse(threadId) {
  const snapshot = getRuntimeSnapshot();
  const threadMeta = snapshot.threads.find((thread) => thread.threadId === threadId);
  if (!threadMeta) return null;
  return deriveThreadState(threadMeta, snapshot.fileIndex.get(threadId));
}

module.exports = {
  getRuntimeSnapshot,
  getThreadsResponse,
  getThreadStateResponse,
};
