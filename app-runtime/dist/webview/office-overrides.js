(function () {
  if (window.__PIXEL_OFFICES_EXEC_HQ__) {
    return;
  }
  window.__PIXEL_OFFICES_EXEC_HQ__ = true;

  var OFFICE_VERSION = 22;
  var MAX_VISIBLE_LIVE_THREADS = 12;
  var GLOBAL_LAYOUT_KEY = "pixel-agents.desktop.layout.v1";
  var ACTIVE_THREAD_KEY = "pixel-agents.desktop.activeThread.v1";
  var ACTIVE_OFFICE_KEY = "pixel-agents.desktop.activeOffice.v1";
  var THREAD_LAYOUT_PREFIX = "pixel-agents.desktop.thread.";
  var THREAD_LAYOUT_SUFFIX = ".layout.v1";
  var THREAD_META_SUFFIX = ".meta.v1";
  var TASK_PRESENCE_KEY = "pixel-agents.desktop.task-presence.v1";
  var TASK_RETENTION_MS = 15 * 60 * 1000;
  var SHARED_OFFICE_ID = "codex-campus-hq";
  var SHARED_OFFICE_TITLE = "\u041e\u0444\u0438\u0441 Codex";
  var OFFICE_SWITCHER_ID = "pixel-office-switcher";
  var OFFICE_HINT_ID = "pixel-office-hint";
  var SETTINGS_MODAL_ID = "pixel-office-settings-modal";
  var SETTINGS_PANEL_ID = "pixel-office-settings-panel";
  var AGENT_LABELS_KEY = "pixel-agents.desktop.agentLabelsVisible.v1";
  var DEFAULT_LAYOUT_PATH = "/assets/default-layout-1.json";
  var WALL = 0;
  var HALL = 1;
  var WOOD = 7;
  var POD = 1;
  var LOUNGE = 9;
  var latestThreadsPayload = null;
  var threadStateCache = Object.create(null);
  var threadStateSyncPromise = null;
  var taskPresenceCache = readJson(TASK_PRESENCE_KEY, {}) || {};
  var bundledOfficeLayoutCache = null;

  var THEMES = [
    {
      hall: color(214, 28, -94, -48),
      boss: color(28, 44, -38, -84),
      pod: color(201, 35, -18, -74),
      lounge: color(32, 18, -12, -12),
      wall: color(215, 14, -88, -36),
    },
    {
      hall: color(210, 16, -90, -44),
      boss: color(18, 46, -34, -82),
      pod: color(190, 28, -14, -68),
      lounge: color(48, 20, -10, -6),
      wall: color(210, 12, -82, -24),
    },
    {
      hall: color(220, 14, -92, -50),
      boss: color(42, 28, -26, -66),
      pod: color(208, 22, -22, -58),
      lounge: color(12, 12, -14, -10),
      wall: color(225, 18, -86, -30),
    },
  ];

  var PC_ON_FRAMES = ["PC_FRONT_ON_1", "PC_FRONT_ON_2", "PC_FRONT_ON_3"];
  var TEXT_REPLACEMENTS = {
    "Loading Pixel Agents": "\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430 Pixel Agents",
    "Loading Codex offices...": "\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430 \u043e\u0444\u0438\u0441\u0430 Codex...",
    "Preparing office assets and live Codex threads...": "\u041f\u043e\u0434\u0433\u043e\u0442\u0430\u0432\u043b\u0438\u0432\u0430\u0435\u043c \u0430\u0441\u0441\u0435\u0442\u044b \u043e\u0444\u0438\u0441\u0430 \u0438 \u0430\u043a\u0442\u0438\u0432\u043d\u044b\u0435 \u0447\u0430\u0442\u044b Codex...",
    "Codex Threads": "\u0427\u0430\u0442\u044b Codex",
    "Codex Floors": "\u041e\u0444\u0438\u0441\u044b Codex",
    "Multi-Office": "\u041e\u0444\u0438\u0441\u044b",
    "Command Center": "\u0426\u0435\u043d\u0442\u0440 \u0443\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u0438\u044f",
    "+ Agent": "+ \u0410\u0433\u0435\u043d\u0442",
    "Show Archived": "\u041f\u043e\u043a\u0430\u0437\u0430\u0442\u044c \u0430\u0440\u0445\u0438\u0432",
    "Hide Archived": "\u0421\u043a\u0440\u044b\u0442\u044c \u0430\u0440\u0445\u0438\u0432",
    "Settings": "\u041d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438",
    "Layout": "\u0420\u0435\u0434\u0430\u043a\u0442\u043e\u0440",
    "Always Show Labels": "\u041f\u043e\u043a\u0430\u0437\u044b\u0432\u0430\u0442\u044c \u043f\u043e\u0434\u043f\u0438\u0441\u0438 \u043d\u0430\u0434 \u0430\u0433\u0435\u043d\u0442\u0430\u043c\u0438",
    "Edit office layout": "\u0418\u0437\u043c\u0435\u043d\u0438\u0442\u044c \u043e\u0444\u0438\u0441",
    "Open editor": "\u041e\u0442\u043a\u0440\u044b\u0442\u044c \u0440\u0435\u0434\u0430\u043a\u0442\u043e\u0440",
    "Open Sessions Folder": "\u041e\u0442\u043a\u0440\u044b\u0442\u044c \u043f\u0430\u043f\u043a\u0443 \u0441\u0435\u0441\u0441\u0438\u0439",
    "Export Layout": "\u042d\u043a\u0441\u043f\u043e\u0440\u0442 \u043e\u0444\u0438\u0441\u0430",
    "Import Layout": "\u0418\u043c\u043f\u043e\u0440\u0442 \u043e\u0444\u0438\u0441\u0430",
    "Add Asset Directory": "\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u043f\u0430\u043f\u043a\u0443 \u0430\u0441\u0441\u0435\u0442\u043e\u0432",
    "Undo": "\u041d\u0430\u0437\u0430\u0434",
    "Redo": "\u0412\u043f\u0435\u0440\u0451\u0434",
    "Save": "\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c",
    "Reset": "\u0421\u0431\u0440\u043e\u0441\u0438\u0442\u044c",
    "Reset?": "\u0421\u0431\u0440\u043e\u0441\u0438\u0442\u044c?",
    "Yes": "\u0414\u0430",
    "No": "\u041d\u0435\u0442",
    "Furniture": "\u041c\u0435\u0431\u0435\u043b\u044c",
    "Floor": "\u041f\u043e\u043b",
    "Wall": "\u0421\u0442\u0435\u043d\u044b",
    "Erase": "\u0421\u0442\u0435\u0440\u0435\u0442\u044c",
    "Color": "\u0426\u0432\u0435\u0442",
    "Pick": "\u0412\u0437\u044f\u0442\u044c",
    "Clear": "\u0421\u0431\u0440\u043e\u0441\u0438\u0442\u044c",
    "Desks": "\u0421\u0442\u043e\u043b\u044b",
    "Chairs": "\u0421\u0442\u0443\u043b\u044c\u044f",
    "Storage": "\u0425\u0440\u0430\u043d\u0435\u043d\u0438\u0435",
    "Tech": "\u0422\u0435\u0445\u043d\u0438\u043a\u0430",
    "Decor": "\u0414\u0435\u043a\u043e\u0440",
    "Misc": "\u041f\u0440\u043e\u0447\u0435\u0435",
    "Rotate (R)": "\u041f\u043e\u0432\u0435\u0440\u043d\u0443\u0442\u044c (R)",
    "Save layout": "\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c \u043e\u0444\u0438\u0441",
    "Reset to last saved layout": "\u0412\u0435\u0440\u043d\u0443\u0442\u044c \u043f\u043e\u0441\u043b\u0435\u0434\u043d\u0435\u0435 \u0441\u043e\u0445\u0440\u0430\u043d\u0451\u043d\u043d\u043e\u0435",
    "Place furniture": "\u0421\u0442\u0430\u0432\u0438\u0442\u044c \u043c\u0435\u0431\u0435\u043b\u044c",
    "Paint floor tiles": "\u041a\u0440\u0430\u0441\u0438\u0442\u044c \u043f\u043e\u043b",
    "Paint walls (click to toggle)": "\u041a\u0440\u0430\u0441\u0438\u0442\u044c \u0441\u0442\u0435\u043d\u044b",
    "Erase tiles to void": "\u0421\u0442\u0435\u0440\u0435\u0442\u044c \u0432 \u043f\u0443\u0441\u0442\u043e\u0442\u0443",
    "Adjust floor color": "\u041d\u0430\u0441\u0442\u0440\u043e\u0438\u0442\u044c \u0446\u0432\u0435\u0442 \u043f\u043e\u043b\u0430",
    "Adjust wall color": "\u041d\u0430\u0441\u0442\u0440\u043e\u0438\u0442\u044c \u0446\u0432\u0435\u0442 \u0441\u0442\u0435\u043d",
    "Adjust selected furniture color": "\u041d\u0430\u0441\u0442\u0440\u043e\u0438\u0442\u044c \u0446\u0432\u0435\u0442 \u043c\u0435\u0431\u0435\u043b\u0438",
    "Pick floor pattern + color from existing tile": "\u0412\u0437\u044f\u0442\u044c \u0443\u0437\u043e\u0440 \u0438 \u0446\u0432\u0435\u0442 \u0441 \u043f\u043e\u043b\u0430",
    "Pick furniture type from placed item": "\u0412\u0437\u044f\u0442\u044c \u0442\u0438\u043f \u043c\u0435\u0431\u0435\u043b\u0438 \u0441\u043e \u0441\u0446\u0435\u043d\u044b",
    "Remove color (restore original)": "\u0423\u0431\u0440\u0430\u0442\u044c \u0446\u0432\u0435\u0442",
    "Sound Notifications": "\u0417\u0432\u0443\u043a\u043e\u0432\u044b\u0435 \u0443\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u044f",
    "Watch All Sessions": "\u0421\u043b\u0435\u0434\u0438\u0442\u044c \u0437\u0430 \u0432\u0441\u0435\u043c\u0438 \u0441\u0435\u0441\u0441\u0438\u044f\u043c\u0438",
    "Instant Detection (Hooks)": "\u041c\u0433\u043d\u043e\u0432\u0435\u043d\u043d\u043e\u0435 \u043e\u0431\u043d\u0430\u0440\u0443\u0436\u0435\u043d\u0438\u0435 (Hooks)",
    "Debug View": "\u041e\u0442\u043b\u0430\u0434\u043a\u0430",
    "View on GitHub": "\u041e\u0442\u043a\u0440\u044b\u0442\u044c GitHub",
    "See what's new": "\u0427\u0442\u043e \u043d\u043e\u0432\u043e\u0433\u043e",
    "See what's new!": "\u0427\u0442\u043e \u043d\u043e\u0432\u043e\u0433\u043e!",
    "Updated to v": "\u041e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u043e \u0434\u043e v",
    "Instant Detection Active": "\u041c\u0433\u043d\u043e\u0432\u0435\u043d\u043d\u043e\u0435 \u043e\u0431\u043d\u0430\u0440\u0443\u0436\u0435\u043d\u0438\u0435 \u0430\u043a\u0442\u0438\u0432\u043d\u043e",
    "View more": "\u041f\u043e\u0434\u0440\u043e\u0431\u043d\u0435\u0435",
    "Instant Detection is ON": "\u041c\u0433\u043d\u043e\u0432\u0435\u043d\u043d\u043e\u0435 \u043e\u0431\u043d\u0430\u0440\u0443\u0436\u0435\u043d\u0438\u0435 \u0432\u043a\u043b\u044e\u0447\u0435\u043d\u043e",
    "Your agents now respond in real-time.": "\u0410\u0433\u0435\u043d\u0442\u044b \u0442\u0435\u043f\u0435\u0440\u044c \u0440\u0435\u0430\u0433\u0438\u0440\u0443\u044e\u0442 \u0432 \u0440\u0435\u0430\u043b\u044c\u043d\u043e\u043c \u0432\u0440\u0435\u043c\u0435\u043d\u0438.",
    "Your Pixel Agents office now reacts in real-time:": "\u041e\u0444\u0438\u0441 Pixel Agents \u0442\u0435\u043f\u0435\u0440\u044c \u0440\u0435\u0430\u0433\u0438\u0440\u0443\u0435\u0442 \u0432 \u0440\u0435\u0430\u043b\u044c\u043d\u043e\u043c \u0432\u0440\u0435\u043c\u0435\u043d\u0438:",
    "Permission prompts appear instantly": "\u0417\u0430\u043f\u0440\u043e\u0441\u044b \u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043d\u0438\u044f \u043f\u043e\u044f\u0432\u043b\u044f\u044e\u0442\u0441\u044f \u0441\u0440\u0430\u0437\u0443",
    "Turn completions detected the moment they happen": "\u0417\u0430\u0432\u0435\u0440\u0448\u0435\u043d\u0438\u0435 \u0445\u043e\u0434\u0430 \u0432\u0438\u0434\u043d\u043e \u0432 \u0442\u0443 \u0436\u0435 \u0441\u0435\u043a\u0443\u043d\u0434\u0443",
    "Sound notifications play immediately": "\u0417\u0432\u0443\u043a\u043e\u0432\u044b\u0435 \u0441\u0438\u0433\u043d\u0430\u043b\u044b \u0437\u0432\u0443\u0447\u0430\u0442 \u0441\u0440\u0430\u0437\u0443",
    "This works through Claude Code Hooks, small event listeners that notify Pixel Agents whenever something happens in your Claude sessions.": "\u042d\u0442\u043e \u0440\u0430\u0431\u043e\u0442\u0430\u0435\u0442 \u0447\u0435\u0440\u0435\u0437 Claude Code Hooks \u2014 \u043d\u0435\u0431\u043e\u043b\u044c\u0448\u0438\u0435 \u0441\u043b\u0443\u0448\u0430\u0442\u0435\u043b\u0438 \u0441\u043e\u0431\u044b\u0442\u0438\u0439, \u043a\u043e\u0442\u043e\u0440\u044b\u0435 \u0441\u043e\u043e\u0431\u0449\u0430\u044e\u0442 Pixel Agents \u043e \u0432\u0441\u0451\u043c, \u0447\u0442\u043e \u043f\u0440\u043e\u0438\u0441\u0445\u043e\u0434\u0438\u0442 \u0432 \u0441\u0435\u0441\u0441\u0438\u044f\u0445 Claude.",
    "Got it": "\u041f\u043e\u043d\u044f\u0442\u043d\u043e",
    "To disable, go to Settings > Instant Detection": "\u0427\u0442\u043e\u0431\u044b \u043e\u0442\u043a\u043b\u044e\u0447\u0438\u0442\u044c, \u043e\u0442\u043a\u0440\u043e\u0439\u0442\u0435 \u041d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438 > \u041c\u0433\u043d\u043e\u0432\u0435\u043d\u043d\u043e\u0435 \u043e\u0431\u043d\u0430\u0440\u0443\u0436\u0435\u043d\u0438\u0435",
    "Needs approval": "\u0422\u0440\u0435\u0431\u0443\u0435\u0442 \u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043d\u0438\u044f",
    "Subtask": "\u0421\u0443\u0431\u0437\u0430\u0434\u0430\u0447\u0430",
    "LEAD": "\u0412\u0435\u0434\u0443\u0449\u0438\u0439",
    "Close agent": "\u0417\u0430\u043a\u0440\u044b\u0442\u044c \u0430\u0433\u0435\u043d\u0442\u0430",
    "Idle": "\u0421\u0432\u043e\u0431\u043e\u0434\u0435\u043d",
    "just now": "\u0442\u043e\u043b\u044c\u043a\u043e \u0447\u0442\u043e",
    "Loading...": "\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430...",
    "Rotate (R)": "\u041f\u043e\u0432\u0435\u0440\u043d\u0443\u0442\u044c (R)",
    "What's New in v": "\u0427\u0442\u043e \u043d\u043e\u0432\u043e\u0433\u043e \u0432 v",
    "Contributors": "\u0410\u0432\u0442\u043e\u0440\u044b",
    "Might be waiting for input": "\u041c\u043e\u0436\u0435\u0442 \u0436\u0434\u0430\u0442\u044c \u0432\u0432\u043e\u0434",
    "Pixel Agents failed to boot": "Pixel Agents \u043d\u0435 \u0441\u043c\u043e\u0433 \u0437\u0430\u043f\u0443\u0441\u0442\u0438\u0442\u044c\u0441\u044f"
  };

  function color(h, s, b, c) {
    return { h: h, s: s, b: b, c: c || 0 };
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function hashString(input) {
    var hash = 2166136261;
    var text = String(input || "codex");
    for (var index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function chooseTheme(threadId) {
    return THEMES[hashString(threadId) % THEMES.length];
  }

  function getLayoutKey(threadId) {
    return THREAD_LAYOUT_PREFIX + threadId + THREAD_LAYOUT_SUFFIX;
  }

  function getPresetLayoutKey(threadId, presetId) {
    return THREAD_LAYOUT_PREFIX + threadId + "." + String(presetId || "office-1") + THREAD_LAYOUT_SUFFIX;
  }

  function getMetaKey(threadId) {
    return THREAD_LAYOUT_PREFIX + threadId + THREAD_META_SUFFIX;
  }

  function getGlobalPresetLayoutKey(presetId) {
    return GLOBAL_LAYOUT_KEY + "." + String(presetId || "office-1");
  }

  function isValidOfficeLayout(layout) {
    if (!layout || typeof layout !== "object") {
      return false;
    }
    if (!Number.isInteger(layout.cols) || !Number.isInteger(layout.rows) || layout.cols <= 0 || layout.rows <= 0) {
      return false;
    }
    var expectedTileCount = layout.cols * layout.rows;
    if (!Array.isArray(layout.tiles) || layout.tiles.length !== expectedTileCount) {
      return false;
    }
    if (layout.tileColors != null && (!Array.isArray(layout.tileColors) || layout.tileColors.length !== expectedTileCount)) {
      return false;
    }
    if (!Array.isArray(layout.furniture)) {
      return false;
    }
    return layout.furniture.every(function (item) {
      return (
        item &&
        typeof item === "object" &&
        typeof item.type === "string" &&
        Number.isInteger(item.col) &&
        Number.isInteger(item.row) &&
        item.col >= 0 &&
        item.col < layout.cols &&
        item.row >= 0 &&
        item.row < layout.rows
      );
    });
  }

  function sanitizeOfficeLayout(layout) {
    return isValidOfficeLayout(layout) ? clone(layout) : getSharedOfficeLayout();
  }

  function readJson(key, fallback) {
    try {
      var raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {}
  }

  function escapeHtml(input) {
    return String(input || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function areAgentLabelsVisible() {
    return readJson(AGENT_LABELS_KEY, false) === true;
  }

  function setAgentLabelsVisible(visible) {
    writeJson(AGENT_LABELS_KEY, !!visible);
    if (document.body) {
      document.body.setAttribute("data-agent-labels", visible ? "visible" : "hidden");
    }
  }

  function makeLayout(cols, rows, theme) {
    var layout = {
      version: 1,
      layoutRevision: OFFICE_VERSION,
      officePresetVersion: OFFICE_VERSION,
      officePreset: "codex-executive-hq",
      cols: cols,
      rows: rows,
      tiles: new Array(cols * rows),
      tileColors: new Array(cols * rows),
      furniture: [],
    };

    for (var row = 0; row < rows; row += 1) {
      for (var col = 0; col < cols; col += 1) {
        var border = row === 0 || row === rows - 1 || col === 0 || col === cols - 1;
        setTile(layout, col, row, border ? WALL : HALL, border ? theme.wall : theme.hall);
      }
    }

    return layout;
  }

  function setTile(layout, col, row, tile, tileColor) {
    if (col < 0 || row < 0 || col >= layout.cols || row >= layout.rows) {
      return;
    }
    var index = row * layout.cols + col;
    layout.tiles[index] = tile;
    layout.tileColors[index] = tileColor == null ? null : clone(tileColor);
  }

  function fillRect(layout, left, top, right, bottom, tile, tileColor) {
    for (var row = top; row <= bottom; row += 1) {
      for (var col = left; col <= right; col += 1) {
        setTile(layout, col, row, tile, tileColor);
      }
    }
  }

  function paintVerticalWall(layout, col, top, bottom, gapRows, theme) {
    var gaps = new Set(gapRows || []);
    for (var row = top; row <= bottom; row += 1) {
      setTile(layout, col, row, gaps.has(row) ? HALL : WALL, gaps.has(row) ? theme.hall : theme.wall);
    }
  }

  function paintHorizontalWall(layout, row, left, right, gapCols, theme) {
    var gaps = new Set(gapCols || []);
    for (var col = left; col <= right; col += 1) {
      setTile(layout, col, row, gaps.has(col) ? HALL : WALL, gaps.has(col) ? theme.hall : theme.wall);
    }
  }

  function addFurniture(layout, type, col, row, uidSuffix) {
    layout.furniture.push({
      uid: type.toLowerCase() + "-" + uidSuffix,
      type: type,
      col: col,
      row: row,
    });
  }

  function addDeskCluster(layout, prefix, deskCol, deskRow, pcType, benchType) {
    addFurniture(layout, "DESK_FRONT", deskCol, deskRow, prefix + "-desk");
    addFurniture(layout, pcType, deskCol + 1, deskRow, prefix + "-pc");
    addFurniture(layout, benchType || "CUSHIONED_BENCH", deskCol + 1, deskRow + 2, prefix + "-seat");
  }

  function parseTime(input) {
    var stamp = Date.parse(input || "");
    return Number.isFinite(stamp) ? stamp : 0;
  }

  function normalizeTitle(input) {
    return String(input || "").replace(/\s+/g, " ").trim();
  }

  function getThreadShortId(threadId) {
    var normalized = normalizeTitle(threadId);
    if (!normalized) {
      return "";
    }
    return normalized.replace(/^thread[\s:-]*/i, "").slice(0, 8);
  }

  function isGenericThreadTitle(title) {
    var normalized = normalizeTitle(title);
    if (!normalized || normalized.length < 4) {
      return true;
    }

    return (
      /^thread\s+[0-9a-f-]{6,}$/i.test(normalized) ||
      /^chat\s+[0-9a-f-]{6,}$/i.test(normalized) ||
      /^untitled\b/i.test(normalized) ||
      /^new\s+chat\b/i.test(normalized) ||
      /^codex\s+thread\b/i.test(normalized)
    );
  }

  function getStoredThreadMeta(threadId) {
    return readJson(getMetaKey(threadId), {}) || {};
  }

  function getOfficePresets() {
    return [
      {
        id: "office-1",
        label: "\u041e\u0444\u0438\u0441 1",
        officePreset: "pixel-agents-layout-1",
        layoutPath: "/assets/default-layout-1.json",
      },
      {
        id: "office-2",
        label: "\u041e\u0444\u0438\u0441 2",
        officePreset: "pixel-agents-layout-2",
        layoutPath: "/assets/default-layout-2.json",
      },
      {
        id: "office-3",
        label: "\u041e\u0444\u0438\u0441 3",
        officePreset: "pixel-agents-layout-3",
        layoutPath: "/assets/default-layout-3.json",
      },
    ];
  }

  function resolveOfficePreset(presetId) {
    var presets = getOfficePresets();
    for (var index = 0; index < presets.length; index += 1) {
      if (presets[index].id === presetId) {
        return presets[index];
      }
    }
    return presets[0];
  }

  function getActiveOfficePreset() {
    try {
      return resolveOfficePreset(window.localStorage.getItem(ACTIVE_OFFICE_KEY) || "office-1");
    } catch (error) {
      return resolveOfficePreset("office-1");
    }
  }

  function setActiveOfficePreset(presetId) {
    var preset = resolveOfficePreset(presetId);
    try {
      window.localStorage.setItem(ACTIVE_OFFICE_KEY, preset.id);
    } catch (error) {}
    return preset;
  }

  function applyOfficePreset(layout, preset) {
    layout.layoutRevision = OFFICE_VERSION;
    layout.officePresetVersion = OFFICE_VERSION;
    layout.officePreset = preset.officePreset;
    layout.officePresetId = preset.id;
    layout.officePresetLabel = preset.label;
    return layout;
  }

  function loadBundledOfficeLayout(layoutPath) {
    var path = layoutPath || DEFAULT_LAYOUT_PATH;
    if (bundledOfficeLayoutCache && bundledOfficeLayoutCache[path]) {
      return clone(bundledOfficeLayoutCache[path]);
    }

    try {
      var request = new XMLHttpRequest();
      request.open("GET", path, false);
      request.send(null);
      if (request.status >= 200 && request.status < 300 && request.responseText) {
        bundledOfficeLayoutCache = bundledOfficeLayoutCache || {};
        bundledOfficeLayoutCache[path] = JSON.parse(request.responseText);
        return clone(bundledOfficeLayoutCache[path]);
      }
    } catch (error) {}

    return null;
  }

  function getSharedOfficeLayout() {
    var preset = getActiveOfficePreset();
    var bundledLayout = loadBundledOfficeLayout(preset.layoutPath);
    if (bundledLayout) {
      return applyOfficePreset(bundledLayout, preset);
    }
    return applyOfficePreset(buildExecutiveOffice(SHARED_OFFICE_ID), preset);
  }

  function normalizeRawThreadState(payload) {
    if (!payload || !Array.isArray(payload.agents)) {
      return payload;
    }

    var next = clone(payload);
    next.agents = next.agents.map(function (agent) {
      if (!agent || !Array.isArray(agent.tools)) {
        return agent;
      }

      if (agent.tools.length === 0 && agent.status === "active") {
        return Object.assign({}, agent, { status: "idle" });
      }

      return agent;
    });

    return next;
  }

  function getPrimaryAgent(payload) {
    if (!payload || !Array.isArray(payload.agents)) {
      return null;
    }

    return (
      payload.agents.find(function (agent) {
        return agent && agent.role === "primary";
      }) || payload.agents[0] || null
    );
  }

  function getRequestedThreadId(url) {
    var marker = "/api/thread-state/";
    var start = url.indexOf(marker);
    if (start === -1) {
      return null;
    }

    var value = url.slice(start + marker.length).split("?")[0];
    try {
      return decodeURIComponent(value);
    } catch (error) {
      return value;
    }
  }

  function cacheThreadState(payload) {
    if (!payload || !payload.threadId) {
      return;
    }

    threadStateCache[payload.threadId] = normalizeRawThreadState(payload);
    updateTaskPresence(payload);
  }

  function getActiveThreadId() {
    try {
      return window.localStorage.getItem(ACTIVE_THREAD_KEY) || null;
    } catch (error) {
      return null;
    }
  }

  function saveTaskPresenceCache() {
    writeJson(TASK_PRESENCE_KEY, taskPresenceCache);
  }

  function normalizeWorkerStatus(input) {
    var status = String(input || "").toLowerCase();
    if (!status) {
      return "idle";
    }
    if (
      status.indexOf("wait") !== -1 ||
      status.indexOf("approval") !== -1 ||
      status.indexOf("input") !== -1 ||
      status.indexOf("blocked") !== -1
    ) {
      return "waiting";
    }
    if (
      status.indexOf("active") !== -1 ||
      status.indexOf("run") !== -1 ||
      status.indexOf("exec") !== -1 ||
      status.indexOf("work") !== -1
    ) {
      return "active";
    }
    return "idle";
  }

  function trimToolLabel(input, fallback) {
    var text = normalizeTitle(input);
    return text || fallback;
  }

  function getTaskKey(agent, tool, toolIndex) {
    var agentKey = agent && agent.agentId ? agent.agentId : "agent";
    var toolKey =
      (tool && (tool.toolId || tool.toolName || tool.status)) ||
      "tool-" + String(toolIndex + 1);
    return String(agentKey) + "::" + String(toolKey);
  }

  function pruneTaskPresence(threadId, now) {
    var bucket = taskPresenceCache[threadId];
    if (!bucket) {
      return;
    }

    Object.keys(bucket).forEach(function (taskKey) {
      var entry = bucket[taskKey];
      var lastSeenAt = entry && entry.lastSeenAt ? entry.lastSeenAt : 0;
      if (now - lastSeenAt > TASK_RETENTION_MS) {
        delete bucket[taskKey];
      }
    });

    if (Object.keys(bucket).length === 0) {
      delete taskPresenceCache[threadId];
    }
  }

  function updateTaskPresence(payload) {
    if (!payload || !payload.threadId) {
      return;
    }

    var now = Date.now();
    var bucket = taskPresenceCache[payload.threadId] || {};
    var seenKeys = Object.create(null);

    if (Array.isArray(payload.agents)) {
      payload.agents.forEach(function (agent) {
        if (!agent || !Array.isArray(agent.tools)) {
          return;
        }

        agent.tools.forEach(function (tool, toolIndex) {
          var taskKey = getTaskKey(agent, tool, toolIndex);
          seenKeys[taskKey] = true;
          bucket[taskKey] = {
            taskKey: taskKey,
            agentId: agent.agentId || "agent",
            agentLabel: trimToolLabel(agent.label, "\u0421\u0443\u0431\u0430\u0433\u0435\u043d\u0442"),
            toolId: tool && tool.toolId ? tool.toolId : taskKey,
            toolName: trimToolLabel(tool && tool.toolName, "\u0417\u0430\u0434\u0430\u0447\u0430"),
            status: normalizeWorkerStatus((tool && tool.status) || agent.status),
            lastSeenAt: now,
          };
        });
      });
    }

    Object.keys(bucket).forEach(function (taskKey) {
      if (!seenKeys[taskKey] && bucket[taskKey] && bucket[taskKey].status === "active") {
        bucket[taskKey].status = "idle";
      }
    });

    taskPresenceCache[payload.threadId] = bucket;
    pruneTaskPresence(payload.threadId, now);
    saveTaskPresenceCache();
  }

  function getRecentTaskEntries(threadId) {
    pruneTaskPresence(threadId, Date.now());
    saveTaskPresenceCache();

    var bucket = taskPresenceCache[threadId];
    if (!bucket) {
      return [];
    }

    return Object.keys(bucket)
      .map(function (taskKey) {
        return bucket[taskKey];
      })
      .filter(Boolean)
      .sort(function (left, right) {
        return (right.lastSeenAt || 0) - (left.lastSeenAt || 0);
      });
  }

  function getReadableWorkerTitle(thread, index) {
    var title = normalizeTitle(thread && thread.title);
    if (!isGenericThreadTitle(title)) {
      return title;
    }
    var taskEntries = thread && thread.threadId ? getRecentTaskEntries(thread.threadId) : [];
    var taskTitle = taskEntries.length ? trimToolLabel(taskEntries[0].toolName, "") : "";
    if (taskTitle && !/^task\b/i.test(taskTitle) && !/^codex\b/i.test(taskTitle)) {
      return taskTitle;
    }
    var cachedState = thread && thread.threadId ? threadStateCache[thread.threadId] : null;
    var primaryAgent = getPrimaryAgent(cachedState);
    var agentTitle = normalizeTitle(primaryAgent && primaryAgent.label);
    if (agentTitle && !/^codex$/i.test(agentTitle)) {
      return agentTitle;
    }
    if (title) {
      return title;
    }
    var shortId = getThreadShortId(thread && thread.threadId);
    return shortId ? "\u041f\u043e\u0442\u043e\u043a " + shortId : "\u041f\u043e\u0442\u043e\u043a";
  }

  function buildWorkersFromThread(thread, index) {
    var cachedState = threadStateCache[thread.threadId] || null;
    var primaryAgent = getPrimaryAgent(cachedState);
    var title = getReadableWorkerTitle(thread, index);
    var taskEntries = getRecentTaskEntries(thread.threadId);
    var taskWorkers = taskEntries.map(function (taskEntry, taskIndex) {
      var taskLabel = trimToolLabel(
        taskEntry.toolName,
        title + " \u0417\u0430\u0434\u0430\u0447\u0430 " + String(taskIndex + 1)
      );
      return {
        agentId: thread.threadId + ":task:" + taskEntry.taskKey,
        role: "subagent",
        label: taskLabel,
        status: normalizeWorkerStatus(taskEntry.status),
        tools: [
          {
            toolId: thread.threadId + ":" + taskEntry.toolId,
            toolName: taskLabel,
            status:
              normalizeWorkerStatus(taskEntry.status) === "idle"
                ? "\u041d\u0435\u0434\u0430\u0432\u043d\u043e \u0438\u0441\u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u043b\u043e\u0441\u044c"
                : taskEntry.agentLabel + " \u0440\u0430\u0431\u043e\u0442\u0430\u0435\u0442",
          },
        ],
      };
    });
    var hasActiveTask = taskWorkers.some(function (worker) {
      return worker.status === "active" || worker.status === "waiting";
    });
    var baseStatus = hasActiveTask
      ? taskWorkers.some(function (worker) {
          return worker.status === "waiting";
        })
        ? "waiting"
        : "active"
      : normalizeWorkerStatus(primaryAgent && primaryAgent.status);

    if (baseStatus === "active" && taskWorkers.length === 0) {
      baseStatus = "idle";
    }

    return [
      {
        agentId: thread.threadId,
        role: "subagent",
        label: title,
        status: baseStatus,
        tools: hasActiveTask
          ? [
              {
                toolId: thread.threadId + ":chat",
                toolName: title,
                status:
                  "\u041a\u043e\u043e\u0440\u0434\u0438\u043d\u0438\u0440\u0443\u0435\u0442 " +
                  String(taskWorkers.length) +
                  " \u0437\u0430\u0434\u0430\u0447",
              },
            ]
          : [],
      },
    ].concat(taskWorkers);
  }

  function buildSharedOfficeState(requestedThreadId, payload) {
    var normalizedPayload = payload ? normalizeRawThreadState(payload) : null;
    if (normalizedPayload) {
      cacheThreadState(normalizedPayload);
    }

    var highlightedThreadId =
      (requestedThreadId && requestedThreadId !== SHARED_OFFICE_ID ? requestedThreadId : null) ||
      (normalizedPayload && normalizedPayload.threadId && normalizedPayload.threadId !== SHARED_OFFICE_ID
        ? normalizedPayload.threadId
        : null) ||
      getActiveThreadId() ||
      (latestThreadsPayload && latestThreadsPayload.currentThreadId) ||
      null;

    var visibleThreads =
      latestThreadsPayload && Array.isArray(latestThreadsPayload.threads)
        ? latestThreadsPayload.threads.slice()
        : [];

    if (
      visibleThreads.length === 0 &&
      normalizedPayload &&
      normalizedPayload.threadId
    ) {
      visibleThreads.push({
        threadId: normalizedPayload.threadId,
        title:
          normalizedPayload.title ||
          ("\u041f\u043e\u0442\u043e\u043a " + getThreadShortId(normalizedPayload.threadId)),
        archived: false,
        lastActiveAt: null,
      });
    }

    visibleThreads.sort(function (left, right) {
      if (highlightedThreadId && left.threadId === highlightedThreadId) {
        return -1;
      }
      if (highlightedThreadId && right.threadId === highlightedThreadId) {
        return 1;
      }
      return parseTime(right.lastActiveAt) - parseTime(left.lastActiveAt);
    });

    var workers = [];
    visibleThreads.forEach(function (thread, index) {
      workers = workers.concat(buildWorkersFromThread(thread, index));
    });
    var activeWorkers = workers.filter(function (worker) {
      return worker.status === "active";
    });
    var waitingWorkers = workers.filter(function (worker) {
      return worker.status === "waiting";
    });
    var leadStatus = activeWorkers.length > 0 ? "active" : waitingWorkers.length > 0 ? "waiting" : "idle";
    var leadTools = [];

    if (activeWorkers.length > 0) {
      leadTools.push({
        toolId: "codex-command-hub",
        toolName: "\u041e\u0440\u043a\u0435\u0441\u0442\u0440\u0430\u0446\u0438\u044f",
        status:
          "\u0423\u043f\u0440\u0430\u0432\u043b\u044f\u0435\u0442 " +
          activeWorkers.length +
          " \u0430\u043a\u0442\u0438\u0432\u043d\u044b\u043c\u0438 \u0447\u0430\u0442\u0430\u043c\u0438",
      });
    } else if (waitingWorkers.length > 0) {
      leadTools.push({
        toolId: "codex-queue",
        toolName: "\u041e\u0447\u0435\u0440\u0435\u0434\u044c",
        status: "\u041e\u0436\u0438\u0434\u0430\u0435\u0442 \u043e\u0442\u0432\u0435\u0442\u0430 \u0432 \u0447\u0430\u0442\u0435",
      });
    }

    return {
      threadId: SHARED_OFFICE_ID,
      title: SHARED_OFFICE_TITLE,
      agents: [
        {
          agentId: "codex-command",
          role: "primary",
          label: "Codex",
          status: leadStatus,
          tools: leadTools,
        },
      ].concat(workers),
    };
  }

  function normalizeThreadState(payload, requestedThreadId) {
    var next = buildSharedOfficeState(requestedThreadId, payload);

    return next;
  }

  function decorateThreadsPayload(payload) {
    if (!payload || !Array.isArray(payload.threads)) {
      return payload;
    }

    var next = clone(payload);
    var currentThreadId = next.currentThreadId || null;
    var liveThreads = next.threads
      .map(function (thread) {
        var storedMeta = getStoredThreadMeta(thread.threadId);
        return Object.assign({}, thread, {
          archived: !!(thread.archived || storedMeta.archived),
          _lastActiveMs: parseTime(thread.lastActiveAt),
          _isMeaningfulTitle: !isGenericThreadTitle(thread.title),
        });
      })
      .sort(function (left, right) {
        return right._lastActiveMs - left._lastActiveMs;
      });

    var visibleThreads = liveThreads.filter(function (thread) {
      return !thread.archived;
    });

    if (currentThreadId) {
      visibleThreads = visibleThreads.sort(function (left, right) {
        if (left.threadId === currentThreadId) {
          return -1;
        }
        if (right.threadId === currentThreadId) {
          return 1;
        }
        return right._lastActiveMs - left._lastActiveMs;
      });
    }

    if (MAX_VISIBLE_LIVE_THREADS > 0 && visibleThreads.length > MAX_VISIBLE_LIVE_THREADS) {
      visibleThreads = visibleThreads.slice(0, MAX_VISIBLE_LIVE_THREADS);
    }

    if (
      currentThreadId &&
      !visibleThreads.some(function (thread) {
        return thread.threadId === currentThreadId;
      })
    ) {
      var currentThread = liveThreads.find(function (thread) {
        return thread.threadId === currentThreadId && !thread.archived;
      });
      if (currentThread) {
        visibleThreads.unshift(currentThread);
      }
    }

    if (MAX_VISIBLE_LIVE_THREADS > 0 && visibleThreads.length > MAX_VISIBLE_LIVE_THREADS) {
      visibleThreads = visibleThreads.slice(0, MAX_VISIBLE_LIVE_THREADS);
    }

    next.threads = visibleThreads.map(function (thread) {
      var normalized = Object.assign({}, thread, {
        archived: false,
      });
      delete normalized._lastActiveMs;
      delete normalized._isMeaningfulTitle;
      return normalized;
    });

    if (
      next.threads.length > 0 &&
      !next.threads.some(function (thread) {
        return thread.threadId === currentThreadId;
      })
    ) {
      next.currentThreadId = next.threads[0].threadId;
    }

    return next;
  }

  function buildSharedThreadsPayload(payload) {
    var next = clone(payload || {});
    var latestActivity = null;

    if (payload && Array.isArray(payload.threads)) {
      for (var index = 0; index < payload.threads.length; index += 1) {
        var thread = payload.threads[index];
        if (!latestActivity || parseTime(thread.lastActiveAt) > parseTime(latestActivity)) {
          latestActivity = thread.lastActiveAt || latestActivity;
        }
      }
    }

    next.currentThreadId = SHARED_OFFICE_ID;
    next.threads = [
      {
        threadId: SHARED_OFFICE_ID,
        title: SHARED_OFFICE_TITLE,
        archived: false,
        lastActiveAt: latestActivity,
      },
    ];
    return next;
  }

  function syncThreadStateCache(threads, nativeFetch) {
    if (!Array.isArray(threads) || threads.length === 0 || typeof nativeFetch !== "function") {
      return Promise.resolve();
    }

    if (threadStateSyncPromise) {
      return threadStateSyncPromise;
    }

    threadStateSyncPromise = Promise.all(
      threads.map(function (thread) {
        return nativeFetch("/api/thread-state/" + encodeURIComponent(thread.threadId))
          .then(function (response) {
            if (!response || !response.ok) {
              return null;
            }
            return response.json();
          })
          .then(function (payload) {
            cacheThreadState(payload);
          })
          .catch(function () {});
      })
    ).finally(function () {
      threadStateSyncPromise = null;
    });

    return threadStateSyncPromise;
  }

  function makeJsonResponse(payload) {
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: {
        "content-type": "application/json",
      },
    });
  }

  function buildExecutiveOffice(threadId) {
    var theme = chooseTheme(threadId);
    var hash = hashString(threadId);
    var layout = makeLayout(28, 18, theme);
    fillRect(layout, 2, 2, 8, 6, WOOD, theme.boss);
    fillRect(layout, 12, 2, 25, 6, POD, theme.pod);
    fillRect(layout, 2, 11, 8, 15, LOUNGE, theme.lounge);
    fillRect(layout, 12, 11, 25, 15, POD, theme.pod);

    addDeskCluster(layout, "command", 3, 2, "PC_FRONT_ON_3");
    addFurniture(layout, "TABLE_FRONT", 6, 2, "meeting-table");
    addFurniture(layout, "WOODEN_CHAIR_BACK", 7, 1, "meeting-chair-north");
    addFurniture(layout, "WOODEN_CHAIR_FRONT", 7, 5, "meeting-chair-south");
    addFurniture(layout, "WOODEN_CHAIR_SIDE", 5, 3, "meeting-chair-west");
    addFurniture(layout, "WOODEN_CHAIR_SIDE:left", 9, 3, "meeting-chair-east");
    addFurniture(layout, "WHITEBOARD", 9, 2, "command-board");
    addFurniture(layout, "DOUBLE_BOOKSHELF", 2, 2, "command-shelf");
    addFurniture(layout, "PLANT_2", 9, 5, "command-plant");

    addDeskCluster(layout, "north-a", 13, 2, PC_ON_FRAMES[hash % PC_ON_FRAMES.length]);
    addDeskCluster(layout, "north-b", 18, 2, PC_ON_FRAMES[(hash + 1) % PC_ON_FRAMES.length]);
    addDeskCluster(layout, "north-c", 13, 4, PC_ON_FRAMES[(hash + 2) % PC_ON_FRAMES.length]);
    addDeskCluster(layout, "north-d", 18, 4, PC_ON_FRAMES[hash % PC_ON_FRAMES.length]);
    addDeskCluster(layout, "north-e", 22, 2, PC_ON_FRAMES[(hash + 1) % PC_ON_FRAMES.length]);
    addDeskCluster(layout, "north-f", 22, 4, PC_ON_FRAMES[(hash + 2) % PC_ON_FRAMES.length]);
    addFurniture(layout, "SMALL_TABLE_SIDE", 25, 2, "north-docs");
    addFurniture(layout, "WHITEBOARD", 25, 4, "north-board");
    addFurniture(layout, "PLANT", 25, 6, "north-plant");

    addFurniture(layout, "SOFA_FRONT", 3, 11, "lounge-front");
    addFurniture(layout, "SOFA_SIDE", 2, 12, "lounge-left");
    addFurniture(layout, "SOFA_SIDE:left", 6, 12, "lounge-right");
    addFurniture(layout, "SOFA_BACK", 3, 14, "lounge-back");
    addFurniture(layout, "COFFEE_TABLE", 4, 12, "lounge-table");
    addFurniture(layout, "CUSHIONED_BENCH", 8, 11, "lounge-bench-a");
    addFurniture(layout, "CUSHIONED_BENCH", 9, 11, "lounge-bench-b");
    addFurniture(layout, "SMALL_TABLE_FRONT", 8, 12, "lounge-side-table");
    addFurniture(layout, "COFFEE", 10, 12, "lounge-coffee");
    addFurniture(layout, "BOOKSHELF", 1, 10, "lounge-shelf");
    addFurniture(layout, "PLANT_2", 10, 15, "lounge-plant");

    addDeskCluster(layout, "south-a", 13, 11, PC_ON_FRAMES[(hash + 1) % PC_ON_FRAMES.length]);
    addDeskCluster(layout, "south-b", 18, 11, PC_ON_FRAMES[(hash + 2) % PC_ON_FRAMES.length]);
    addDeskCluster(layout, "south-c", 13, 13, PC_ON_FRAMES[hash % PC_ON_FRAMES.length]);
    addDeskCluster(layout, "south-d", 18, 13, PC_ON_FRAMES[(hash + 1) % PC_ON_FRAMES.length]);
    addDeskCluster(layout, "south-e", 22, 11, PC_ON_FRAMES[(hash + 2) % PC_ON_FRAMES.length]);
    addDeskCluster(layout, "south-f", 22, 13, PC_ON_FRAMES[hash % PC_ON_FRAMES.length]);
    addFurniture(layout, "SMALL_TABLE_SIDE", 25, 11, "south-printer");
    addFurniture(layout, "DOUBLE_BOOKSHELF", 25, 14, "south-shelf");
    addFurniture(layout, "WHITEBOARD", 25, 12, "south-board");
    addFurniture(layout, "PLANT", 25, 15, "south-plant");

    return layout;
  }

  function buildStudioOffice(threadId) {
    var theme = chooseTheme(threadId);
    var hash = hashString(threadId);
    var layout = makeLayout(28, 18, theme);

    fillRect(layout, 2, 2, 11, 6, POD, theme.pod);
    fillRect(layout, 16, 2, 25, 6, WOOD, theme.boss);
    fillRect(layout, 2, 11, 7, 15, LOUNGE, theme.lounge);
    fillRect(layout, 10, 11, 17, 15, POD, theme.pod);
    fillRect(layout, 20, 11, 25, 15, POD, theme.pod);

    addDeskCluster(layout, "west-a", 2, 2, PC_ON_FRAMES[hash % PC_ON_FRAMES.length]);
    addDeskCluster(layout, "west-b", 6, 2, PC_ON_FRAMES[(hash + 1) % PC_ON_FRAMES.length]);
    addDeskCluster(layout, "west-c", 2, 4, PC_ON_FRAMES[(hash + 2) % PC_ON_FRAMES.length]);
    addDeskCluster(layout, "west-d", 6, 4, PC_ON_FRAMES[hash % PC_ON_FRAMES.length]);
    addFurniture(layout, "WHITEBOARD", 10, 2, "west-board");
    addFurniture(layout, "PLANT_2", 11, 5, "west-plant");

    addDeskCluster(layout, "east-a", 16, 2, PC_ON_FRAMES[(hash + 1) % PC_ON_FRAMES.length]);
    addDeskCluster(layout, "east-b", 20, 2, PC_ON_FRAMES[(hash + 2) % PC_ON_FRAMES.length]);
    addDeskCluster(layout, "east-c", 16, 4, PC_ON_FRAMES[hash % PC_ON_FRAMES.length]);
    addDeskCluster(layout, "east-d", 20, 4, PC_ON_FRAMES[(hash + 1) % PC_ON_FRAMES.length]);
    addFurniture(layout, "SMALL_TABLE_SIDE", 24, 2, "east-docs");
    addFurniture(layout, "DOUBLE_BOOKSHELF", 24, 4, "east-shelf");
    addFurniture(layout, "PLANT", 25, 6, "east-plant");

    addFurniture(layout, "SOFA_FRONT", 2, 11, "lounge-front");
    addFurniture(layout, "SOFA_SIDE", 2, 12, "lounge-left");
    addFurniture(layout, "SOFA_SIDE:left", 6, 12, "lounge-right");
    addFurniture(layout, "SOFA_BACK", 3, 14, "lounge-back");
    addFurniture(layout, "COFFEE_TABLE", 4, 12, "lounge-table");
    addFurniture(layout, "CUSHIONED_BENCH", 6, 14, "lounge-bench-a");
    addFurniture(layout, "COFFEE", 7, 11, "lounge-coffee");
    addFurniture(layout, "PLANT", 7, 15, "lounge-plant");

    addDeskCluster(layout, "south-a", 10, 11, PC_ON_FRAMES[(hash + 2) % PC_ON_FRAMES.length]);
    addDeskCluster(layout, "south-b", 14, 11, PC_ON_FRAMES[hash % PC_ON_FRAMES.length]);
    addDeskCluster(layout, "south-c", 10, 13, PC_ON_FRAMES[(hash + 1) % PC_ON_FRAMES.length]);
    addDeskCluster(layout, "south-d", 14, 13, PC_ON_FRAMES[(hash + 2) % PC_ON_FRAMES.length]);
    addFurniture(layout, "SMALL_TABLE_FRONT", 17, 11, "south-printer");
    addFurniture(layout, "WHITEBOARD", 17, 13, "south-board");

    addDeskCluster(layout, "south-e", 20, 11, PC_ON_FRAMES[(hash + 1) % PC_ON_FRAMES.length]);
    addDeskCluster(layout, "south-f", 20, 13, PC_ON_FRAMES[hash % PC_ON_FRAMES.length]);
    addFurniture(layout, "TABLE_FRONT", 23, 11, "focus-table");
    addFurniture(layout, "WOODEN_CHAIR_BACK", 24, 10, "focus-chair-north");
    addFurniture(layout, "WOODEN_CHAIR_FRONT", 24, 14, "focus-chair-south");
    addFurniture(layout, "PLANT_2", 25, 15, "focus-plant");

    return layout;
  }

  function writeThreadOffice(threadId, archived) {
    var layout = readJson(getLayoutKey(threadId), null);
    var meta = readJson(getMetaKey(threadId), {}) || {};
    var preset = getActiveOfficePreset();
    var previousPresetId = meta.officePresetId || (layout && layout.officePresetId) || null;
    var needsUpgrade =
      !layout ||
      layout.officePresetVersion !== OFFICE_VERSION ||
      meta.officePresetVersion !== OFFICE_VERSION ||
      layout.officePreset !== preset.officePreset ||
      meta.officePreset !== preset.officePreset ||
      layout.officePresetId !== preset.id ||
      meta.officePresetId !== preset.id;

    if (layout && previousPresetId) {
      writeJson(getPresetLayoutKey(threadId, previousPresetId), layout);
    }

    if (needsUpgrade) {
      var storedPresetLayout = readJson(getPresetLayoutKey(threadId, preset.id), null);
      writeJson(
        getLayoutKey(threadId),
        storedPresetLayout &&
          storedPresetLayout.officePresetVersion === OFFICE_VERSION &&
          storedPresetLayout.officePresetId === preset.id
          ? storedPresetLayout
          : getSharedOfficeLayout()
      );
    }

    writeJson(
      getMetaKey(threadId),
      Object.assign({}, meta, {
        archived: archived == null ? !!meta.archived : !!archived,
        officePresetVersion: OFFICE_VERSION,
        officePreset: preset.officePreset,
        officePresetId: preset.id,
      })
    );
  }

  function seedGlobalOffice() {
    var preset = getActiveOfficePreset();
    var existing = readJson(GLOBAL_LAYOUT_KEY, null);
    var previousPresetId = existing && existing.officePresetId ? existing.officePresetId : null;
    if (existing && previousPresetId) {
      writeJson(getGlobalPresetLayoutKey(previousPresetId), existing);
    }
    if (
      !existing ||
      existing.officePresetVersion !== OFFICE_VERSION ||
      existing.officePreset !== preset.officePreset ||
      existing.officePresetId !== preset.id
    ) {
      var storedGlobalLayout = readJson(getGlobalPresetLayoutKey(preset.id), null);
      writeJson(
        GLOBAL_LAYOUT_KEY,
        storedGlobalLayout &&
          storedGlobalLayout.officePresetVersion === OFFICE_VERSION &&
          storedGlobalLayout.officePresetId === preset.id
          ? storedGlobalLayout
          : getSharedOfficeLayout()
      );
    }
    writeThreadOffice(SHARED_OFFICE_ID, false);
  }

  function upgradeKnownThreadKeys() {
    try {
      var presetIds = getOfficePresets().map(function (preset) {
        return "." + preset.id;
      });
      var keys = [];
      for (var index = 0; index < window.localStorage.length; index += 1) {
        var key = window.localStorage.key(index);
        if (key && key.indexOf(THREAD_LAYOUT_PREFIX) === 0 && key.indexOf(THREAD_LAYOUT_SUFFIX) > -1) {
          keys.push(key);
        }
      }

      keys.forEach(function (key) {
        var threadId = key.slice(THREAD_LAYOUT_PREFIX.length, key.length - THREAD_LAYOUT_SUFFIX.length);
        if (
          presetIds.some(function (suffix) {
            return threadId.slice(-suffix.length) === suffix;
          })
        ) {
          return;
        }
        var meta = readJson(getMetaKey(threadId), {}) || {};
        writeThreadOffice(threadId, meta.archived);
      });
    } catch (error) {}
  }

  function seedThreads(threads) {
    if (!Array.isArray(threads)) {
      return;
    }

    threads.forEach(function (thread) {
      if (!thread || !thread.threadId) {
        return;
      }
      writeThreadOffice(thread.threadId, thread.archived);
    });
  }

  function refreshOfficeLayouts() {
    writeJson(GLOBAL_LAYOUT_KEY, getSharedOfficeLayout());
    writeThreadOffice(SHARED_OFFICE_ID, false);
    upgradeKnownThreadKeys();

    if (latestThreadsPayload && Array.isArray(latestThreadsPayload.threads)) {
      seedThreads(latestThreadsPayload.threads);
    }
  }

  function getKnownThreadIds(extraThreadId) {
    var seen = Object.create(null);
    var ids = [];

    function pushThreadId(threadId) {
      if (!threadId || seen[threadId]) {
        return;
      }
      seen[threadId] = true;
      ids.push(threadId);
    }

    pushThreadId(SHARED_OFFICE_ID);
    pushThreadId(extraThreadId);
    pushThreadId(getActiveThreadId());

    if (latestThreadsPayload && Array.isArray(latestThreadsPayload.threads)) {
      latestThreadsPayload.threads.forEach(function (thread) {
        if (thread && thread.threadId && !thread.archived) {
          pushThreadId(thread.threadId);
        }
      });
    }

    return ids;
  }

  function getCurrentOfficeLayout() {
    var activeThreadId = getActiveThreadId();
    var currentThreadLayout = activeThreadId ? readJson(getLayoutKey(activeThreadId), null) : null;
    var globalLayout = readJson(GLOBAL_LAYOUT_KEY, null);
    var sharedLayout = readJson(getLayoutKey(SHARED_OFFICE_ID), null);
    return sanitizeOfficeLayout(currentThreadLayout || globalLayout || sharedLayout);
  }

  function persistOfficeLayout(layout, sourceThreadId) {
    var preset = getActiveOfficePreset();
    var preparedLayout = applyOfficePreset(sanitizeOfficeLayout(layout), preset);
    writeJson(GLOBAL_LAYOUT_KEY, preparedLayout);
    writeJson(getGlobalPresetLayoutKey(preset.id), preparedLayout);

    getKnownThreadIds(sourceThreadId).forEach(function (threadId) {
      var existingMeta = readJson(getMetaKey(threadId), {}) || {};
      writeJson(getLayoutKey(threadId), preparedLayout);
      writeJson(getPresetLayoutKey(threadId, preset.id), preparedLayout);
      writeJson(
        getMetaKey(threadId),
        Object.assign({}, existingMeta, {
          officePresetVersion: OFFICE_VERSION,
          officePreset: preset.officePreset,
          officePresetId: preset.id,
          archived: !!existingMeta.archived,
        })
      );
    });

    return preparedLayout;
  }

  function desktopApiRequest(url, init) {
    var options = Object.assign(
      {
        method: "GET",
        headers: {},
      },
      init || {}
    );

    if (options.body && !options.headers["Content-Type"]) {
      options.headers["Content-Type"] = "application/json";
    }

    return window.fetch(url, options).then(function (response) {
      return response.text().then(function (rawText) {
        var payload = {};
        if (rawText) {
          try {
            payload = JSON.parse(rawText);
          } catch (error) {
            payload = { ok: response.ok, rawText: rawText };
          }
        }

        if (!response.ok || (payload && payload.ok === false && !payload.cancelled)) {
          throw new Error((payload && payload.error) || "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0432\u044b\u043f\u043e\u043b\u043d\u0438\u0442\u044c \u0437\u0430\u043f\u0440\u043e\u0441.");
        }

        return payload;
      });
    });
  }

  function fetchDesktopConfig() {
    return desktopApiRequest("/api/desktop/config");
  }

  function openSessionsFolder() {
    return desktopApiRequest("/api/desktop/open-sessions-folder", { method: "POST" }).then(function (payload) {
      showOfficeHint(payload && payload.path ? "\u041e\u0442\u043a\u0440\u044b\u0442\u0430 \u043f\u0430\u043f\u043a\u0430 \u0441\u0435\u0441\u0441\u0438\u0439" : "\u041f\u0430\u043f\u043a\u0430 \u0441\u0435\u0441\u0441\u0438\u0439 \u043e\u0442\u043a\u0440\u044b\u0442\u0430");
      return payload;
    });
  }

  function exportOfficeLayout() {
    var layout = getCurrentOfficeLayout();
    return desktopApiRequest("/api/desktop/export-layout", {
      method: "POST",
      body: JSON.stringify({ layout: layout }),
    }).then(function (payload) {
      if (!payload || payload.cancelled) {
        return payload;
      }
      showOfficeHint("\u041e\u0444\u0438\u0441 \u044d\u043a\u0441\u043f\u043e\u0440\u0442\u0438\u0440\u043e\u0432\u0430\u043d");
      return payload;
    });
  }

  function importOfficeLayout() {
    return desktopApiRequest("/api/desktop/import-layout", { method: "POST" }).then(function (payload) {
      if (!payload || payload.cancelled || !payload.layout) {
        return payload;
      }
      persistOfficeLayout(payload.layout);
      showOfficeHint("\u041e\u0444\u0438\u0441 \u0438\u043c\u043f\u043e\u0440\u0442\u0438\u0440\u043e\u0432\u0430\u043d");
      window.setTimeout(function () {
        window.location.reload();
      }, 140);
      return payload;
    });
  }

  function addExternalAssetDirectory() {
    return desktopApiRequest("/api/desktop/add-asset-directory", { method: "POST" }).then(function (payload) {
      if (!payload || payload.cancelled) {
        return payload;
      }
      showOfficeHint("\u041f\u0430\u043f\u043a\u0430 \u0430\u0441\u0441\u0435\u0442\u043e\u0432 \u043f\u043e\u0434\u043a\u043b\u044e\u0447\u0435\u043d\u0430");
      window.setTimeout(function () {
        window.location.reload();
      }, 140);
      return payload;
    });
  }

  function removeExternalAssetDirectory(targetPath) {
    return desktopApiRequest("/api/desktop/remove-asset-directory", {
      method: "POST",
      body: JSON.stringify({ path: targetPath }),
    }).then(function (payload) {
      showOfficeHint("\u041f\u0430\u043f\u043a\u0430 \u0430\u0441\u0441\u0435\u0442\u043e\u0432 \u043e\u0442\u043a\u043b\u044e\u0447\u0435\u043d\u0430");
      return payload;
    });
  }

  function patchDesktopHost() {
    var host = window.__PIXEL_AGENTS_HOST__;
    if (!host || typeof host.postMessage !== "function") {
      return false;
    }

    if (host.__pixelOfficeBridgePatched__) {
      return true;
    }

    var originalPostMessage = host.postMessage.bind(host);
    host.postMessage = function (message) {
      if (!message || typeof message !== "object") {
        return originalPostMessage(message);
      }

      if (message.type === "saveLayout" && message.layout) {
        var syncedLayout = persistOfficeLayout(message.layout, typeof message.threadId === "string" ? message.threadId : null);
        return originalPostMessage(
          Object.assign({}, message, {
            layout: syncedLayout,
          })
        );
      }

      if (message.type === "openSessionsFolder") {
        openSessionsFolder().catch(function (error) {
          showOfficeHint(error && error.message ? error.message : "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043e\u0442\u043a\u0440\u044b\u0442\u044c \u043f\u0430\u043f\u043a\u0443 \u0441\u0435\u0441\u0441\u0438\u0439");
        });
        return;
      }

      if (message.type === "exportLayout") {
        exportOfficeLayout().catch(function (error) {
          showOfficeHint(error && error.message ? error.message : "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u044d\u043a\u0441\u043f\u043e\u0440\u0442\u0438\u0440\u043e\u0432\u0430\u0442\u044c \u043e\u0444\u0438\u0441");
        });
        return;
      }

      if (message.type === "importLayout") {
        importOfficeLayout().catch(function (error) {
          showOfficeHint(error && error.message ? error.message : "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0438\u043c\u043f\u043e\u0440\u0442\u0438\u0440\u043e\u0432\u0430\u0442\u044c \u043e\u0444\u0438\u0441");
        });
        return;
      }

      if (message.type === "addExternalAssetDirectory") {
        addExternalAssetDirectory().catch(function (error) {
          showOfficeHint(error && error.message ? error.message : "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0434\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u043f\u0430\u043f\u043a\u0443 \u0430\u0441\u0441\u0435\u0442\u043e\u0432");
        });
        return;
      }

      if (message.type === "removeExternalAssetDirectory" && message.path) {
        removeExternalAssetDirectory(message.path)
          .then(function () {
            window.location.reload();
          })
          .catch(function (error) {
            showOfficeHint(error && error.message ? error.message : "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0443\u0431\u0440\u0430\u0442\u044c \u043f\u0430\u043f\u043a\u0443 \u0430\u0441\u0441\u0435\u0442\u043e\u0432");
          });
        return;
      }

      return originalPostMessage(message);
    };

    host.__pixelOfficeBridgePatched__ = true;
    return true;
  }

  function ensureDesktopHostPatch() {
    if (patchDesktopHost()) {
      return;
    }

    var attempts = 0;
    var timer = window.setInterval(function () {
      attempts += 1;
      if (patchDesktopHost() || attempts > 120) {
        window.clearInterval(timer);
      }
    }, 250);
  }

  function wrapFetch() {
    if (typeof window.fetch !== "function") {
      return;
    }

    var nativeFetch = window.fetch.bind(window);
    window.fetch = function (input, init) {
      var url = typeof input === "string" ? input : input && input.url ? input.url : "";

      if (url.indexOf("/api/thread-state/" + encodeURIComponent(SHARED_OFFICE_ID)) !== -1) {
        return syncThreadStateCache(
          latestThreadsPayload && Array.isArray(latestThreadsPayload.threads) ? latestThreadsPayload.threads : [],
          nativeFetch
        ).then(function () {
          return makeJsonResponse(normalizeThreadState(null, SHARED_OFFICE_ID));
        });
      }

      return nativeFetch(input, init).then(function (response) {
        try {
          if (url.indexOf("/assets/asset-index.json") !== -1) {
            var originalAssetIndexJson = response.json.bind(response);
            response.json = function () {
              return originalAssetIndexJson().then(function (payload) {
                if (!payload || typeof payload !== "object") {
                  return payload;
                }
                var preset = getActiveOfficePreset();
                var defaultLayoutName = String(preset.layoutPath || DEFAULT_LAYOUT_PATH).split("/").pop();
                return Object.assign({}, payload, {
                  defaultLayout: defaultLayoutName,
                });
              });
            };
          }

          if (url.indexOf("/api/threads") !== -1) {
            var originalThreadsJson = response.json.bind(response);
            response.json = function () {
              return originalThreadsJson().then(function (payload) {
                var normalized = decorateThreadsPayload(payload);
                latestThreadsPayload = normalized;
                if (normalized && Array.isArray(normalized.threads)) {
                  seedThreads(normalized.threads);
                }
                return syncThreadStateCache(normalized.threads, nativeFetch).then(function () {
                  return buildSharedThreadsPayload(normalized);
                });
              });
            };
          }

          if (url.indexOf("/api/thread-state/") !== -1) {
            var originalStateJson = response.json.bind(response);
            response.json = function () {
              var requestedThreadId = getRequestedThreadId(url);
              return originalStateJson().then(function (payload) {
                return normalizeThreadState(payload, requestedThreadId);
              });
            };
          }

          if (url.indexOf("/api/threads") !== -1 && typeof response.clone === "function") {
            response
              .clone()
              .json()
              .then(function (payload) {
                var normalized = decorateThreadsPayload(payload);
                latestThreadsPayload = normalized;
                if (normalized && Array.isArray(normalized.threads)) {
                  seedThreads(normalized.threads);
                }
                return syncThreadStateCache(normalized.threads, nativeFetch);
              })
              .catch(function () {});
          }
        } catch (error) {}

        return response;
      });
    };
  }

  function replaceText(node) {
    if (!node || node.nodeType !== Node.TEXT_NODE) {
      return;
    }
    var current = node.textContent;
    if (!current) {
      return;
    }
    var trimmed = current.trim();
    if (!trimmed) {
      return;
    }
    if (isGenericThreadTitle(trimmed)) {
      var shortId = getThreadShortId(trimmed);
      node.textContent = current.replace(trimmed, shortId ? "\u041f\u043e\u0442\u043e\u043a " + shortId : "\u041f\u043e\u0442\u043e\u043a");
      return;
    }
    if (!Object.prototype.hasOwnProperty.call(TEXT_REPLACEMENTS, trimmed)) {
      return;
    }
    node.textContent = current.replace(trimmed, TEXT_REPLACEMENTS[trimmed]);
  }

  function walkAndReplace(node) {
    if (!node) {
      return;
    }
    if (node.nodeType === Node.TEXT_NODE) {
      replaceText(node);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE || node.tagName === "SCRIPT" || node.tagName === "STYLE") {
      return;
    }
    for (var index = 0; index < node.childNodes.length; index += 1) {
      walkAndReplace(node.childNodes[index]);
    }
  }

  function startTextSync() {
    if (!document.body || window.__PIXEL_OFFICES_TEXT_SYNC__) {
      return;
    }
    window.__PIXEL_OFFICES_TEXT_SYNC__ = true;
    setAgentLabelsVisible(areAgentLabelsVisible());
    walkAndReplace(document.body);
    bindOfficeHintListener();
    ensureOfficeSwitcher();
    ensureDesktopHostPatch();

    var observer = new MutationObserver(function (records) {
      records.forEach(function (record) {
        if (record.type === "characterData") {
          replaceText(record.target);
          return;
        }
        record.addedNodes.forEach(function (node) {
          walkAndReplace(node);
        });
      });
      if (!document.getElementById(OFFICE_SWITCHER_ID)) {
        ensureOfficeSwitcher();
      }
    });

    observer.observe(document.body, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  }

  function styleOfficeSwitcherButton(button, active) {
    if (!button) {
      return null;
    }
    button.className = "pixel-office-control";
    if (active) {
      button.setAttribute("data-active", "true");
    } else {
      button.removeAttribute("data-active");
    }
    return button;
  }

  function showOfficeHint(message) {
    if (!document.body) {
      return;
    }

    var root = document.getElementById(OFFICE_HINT_ID);
    if (!root) {
      root = document.createElement("div");
      root.id = OFFICE_HINT_ID;
      root.setAttribute("role", "status");
      root.setAttribute("aria-live", "polite");
      document.body.appendChild(root);
    }

    root.textContent = String(message || "");
    root.setAttribute("data-visible", message ? "true" : "false");
    if (root.__pixelHintTimer) {
      window.clearTimeout(root.__pixelHintTimer);
    }
    if (message) {
      root.__pixelHintTimer = window.setTimeout(function () {
        root.setAttribute("data-visible", "false");
      }, 2200);
    }
  }

  function bindOfficeHintListener() {
    if (window.__PIXEL_OFFICE_HINT_BOUND__) {
      return;
    }
    window.__PIXEL_OFFICE_HINT_BOUND__ = true;
    window.addEventListener("pixel-office-hint", function (event) {
      var message = event && event.detail && event.detail.message ? event.detail.message : "";
      if (message) {
        showOfficeHint(message);
      }
    });
  }

  function getSettingsModalRoot() {
    if (!document.body) {
      return null;
    }

    var root = document.getElementById(SETTINGS_MODAL_ID);
    if (root) {
      return root;
    }

    root = document.createElement("div");
    root.id = SETTINGS_MODAL_ID;
    root.setAttribute("aria-hidden", "true");
    root.addEventListener("click", function (event) {
      var clickTarget =
        event.target && event.target.nodeType === Node.ELEMENT_NODE
          ? event.target
          : event.target && event.target.parentElement
          ? event.target.parentElement
          : null;

      if (clickTarget === root || (clickTarget && clickTarget.getAttribute("data-action") === "close-settings")) {
        closeSettingsModal();
        return;
      }

      var actionTarget = clickTarget && clickTarget.closest ? clickTarget.closest("[data-action]") : null;
      if (!actionTarget) {
        return;
      }

      var action = actionTarget.getAttribute("data-action");
      if (action === "open-editor") {
        closeSettingsModal();
        if (!openBuiltInEditor()) {
          showOfficeHint("\u0420\u0435\u0434\u0430\u043a\u0442\u043e\u0440 \u043e\u0444\u0438\u0441\u0430 \u043f\u043e\u043a\u0430 \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d");
        }
        return;
      }

      if (action === "open-sessions") {
        openSessionsFolder().catch(function (error) {
          showOfficeHint(error && error.message ? error.message : "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043e\u0442\u043a\u0440\u044b\u0442\u044c \u043f\u0430\u043f\u043a\u0443 \u0441\u0435\u0441\u0441\u0438\u0439");
        });
        return;
      }

      if (action === "export-office") {
        exportOfficeLayout().catch(function (error) {
          showOfficeHint(error && error.message ? error.message : "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u044d\u043a\u0441\u043f\u043e\u0440\u0442\u0438\u0440\u043e\u0432\u0430\u0442\u044c \u043e\u0444\u0438\u0441");
        });
        return;
      }

      if (action === "import-office") {
        importOfficeLayout().catch(function (error) {
          showOfficeHint(error && error.message ? error.message : "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0438\u043c\u043f\u043e\u0440\u0442\u0438\u0440\u043e\u0432\u0430\u0442\u044c \u043e\u0444\u0438\u0441");
        });
        return;
      }

      if (action === "add-assets") {
        addExternalAssetDirectory().catch(function (error) {
          showOfficeHint(error && error.message ? error.message : "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0434\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u043f\u0430\u043f\u043a\u0443 \u0430\u0441\u0441\u0435\u0442\u043e\u0432");
        });
        return;
      }

      if (action === "remove-assets") {
        var encodedPath = actionTarget.getAttribute("data-path") || "";
        var decodedPath = "";
        try {
          decodedPath = decodeURIComponent(encodedPath);
        } catch (error) {
          decodedPath = encodedPath;
        }

        removeExternalAssetDirectory(decodedPath)
          .then(function () {
            window.setTimeout(function () {
              window.location.reload();
            }, 140);
          })
          .catch(function (error) {
            showOfficeHint(error && error.message ? error.message : "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0443\u0431\u0440\u0430\u0442\u044c \u043f\u0430\u043f\u043a\u0443 \u0430\u0441\u0441\u0435\u0442\u043e\u0432");
          });
      }
    });

    root.addEventListener("change", function (event) {
      var target = event.target;
      if (!target || target.getAttribute("data-setting") !== "agent-labels") {
        return;
      }

      setAgentLabelsVisible(!!target.checked);
      showOfficeHint(target.checked ? "\u041f\u043e\u0434\u043f\u0438\u0441\u0438 \u043f\u043e\u043a\u0430\u0437\u0430\u043d\u044b" : "\u041f\u043e\u0434\u043f\u0438\u0441\u0438 \u0441\u043a\u0440\u044b\u0442\u044b");
    });

    document.body.appendChild(root);
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        closeSettingsModal();
      }
    });
    return root;
  }

  function closeSettingsModal() {
    var root = document.getElementById(SETTINGS_MODAL_ID);
    if (!root) {
      return;
    }
    root.setAttribute("aria-hidden", "true");
    root.innerHTML = "";
  }

  function renderSettingsModal(payload) {
    var root = getSettingsModalRoot();
    if (!root) {
      return;
    }

    var assetDirs = payload && Array.isArray(payload.externalAssetDirectories) ? payload.externalAssetDirectories : [];
    var assetRows = assetDirs.length
      ? assetDirs
          .map(function (dirPath) {
            return (
              '<div class="pixel-settings-asset-row">' +
              '<div class="pixel-settings-asset-copy">' +
              '<span class="pixel-settings-asset-name">' +
              escapeHtml(String(dirPath).split(/[/\\\\]/).pop() || dirPath) +
              '</span>' +
              '<span class="pixel-settings-asset-path" title="' +
              escapeHtml(dirPath) +
              '">' +
              escapeHtml(dirPath) +
              '</span>' +
              '</div>' +
              '<button type="button" class="pixel-settings-asset-remove" data-action="remove-assets" data-path="' +
              encodeURIComponent(dirPath) +
              '">' +
              '\u0423\u0431\u0440\u0430\u0442\u044c' +
              '</button>' +
              '</div>'
            );
          })
          .join("")
      : '<div class="pixel-settings-empty">\u041f\u0430\u043f\u043a\u0438 \u0430\u0441\u0441\u0435\u0442\u043e\u0432 \u043f\u043e\u043a\u0430 \u043d\u0435 \u043f\u043e\u0434\u043a\u043b\u044e\u0447\u0435\u043d\u044b.</div>';

    root.innerHTML =
      '<div id="' +
      SETTINGS_PANEL_ID +
      '" class="pixel-office-settings-panel" role="dialog" aria-modal="true" aria-label="\u041d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438 \u043e\u0444\u0438\u0441\u0430">' +
      '<div class="pixel-office-settings-head">' +
      '<div>' +
      '<div class="pixel-office-settings-kicker">\u041d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438</div>' +
      '<div class="pixel-office-settings-title">\u0423\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u0438\u0435 \u043e\u0444\u0438\u0441\u043e\u043c</div>' +
      '</div>' +
      '<button type="button" class="pixel-office-settings-close" data-action="close-settings" aria-label="\u0417\u0430\u043a\u0440\u044b\u0442\u044c">\u00d7</button>' +
      '</div>' +
      '<div class="pixel-office-settings-actions">' +
      '<button type="button" class="pixel-settings-primary" data-action="open-editor">\u041e\u0442\u043a\u0440\u044b\u0442\u044c \u0440\u0435\u0434\u0430\u043a\u0442\u043e\u0440</button>' +
      '<button type="button" class="pixel-settings-primary" data-action="open-sessions">\u041e\u0442\u043a\u0440\u044b\u0442\u044c \u043f\u0430\u043f\u043a\u0443 \u0441\u0435\u0441\u0441\u0438\u0439</button>' +
      '<button type="button" class="pixel-settings-primary" data-action="export-office">\u042d\u043a\u0441\u043f\u043e\u0440\u0442 \u043e\u0444\u0438\u0441\u0430</button>' +
      '<button type="button" class="pixel-settings-primary" data-action="import-office">\u0418\u043c\u043f\u043e\u0440\u0442 \u043e\u0444\u0438\u0441\u0430</button>' +
      '<button type="button" class="pixel-settings-primary" data-action="add-assets">\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u043f\u0430\u043f\u043a\u0443 \u0430\u0441\u0441\u0435\u0442\u043e\u0432</button>' +
      '</div>' +
      '<label class="pixel-office-settings-toggle">' +
      '<input type="checkbox" data-setting="agent-labels"' +
      (areAgentLabelsVisible() ? " checked" : "") +
      " />" +
      '<span>\u041f\u043e\u043a\u0430\u0437\u044b\u0432\u0430\u0442\u044c \u043f\u043e\u0434\u043f\u0438\u0441\u0438 \u043d\u0430\u0434 \u0430\u0433\u0435\u043d\u0442\u0430\u043c\u0438</span>' +
      "</label>" +
      '<div class="pixel-office-settings-assets">' +
      '<div class="pixel-office-settings-section-title">\u041f\u043e\u0434\u043a\u043b\u044e\u0447\u0435\u043d\u043d\u044b\u0435 \u043f\u0430\u043f\u043a\u0438 \u0430\u0441\u0441\u0435\u0442\u043e\u0432</div>' +
      assetRows +
      "</div>" +
      '<div class="pixel-office-settings-footnote">\u041f\u043e\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u044e\u0442\u0441\u044f \u043f\u0430\u043f\u043a\u0438 \u0441 assets/characters \u0438\u043b\u0438 assets/furniture, \u0430 \u043d\u043e\u0432\u044b\u0435 \u0430\u0441\u0441\u0435\u0442\u044b \u043f\u043e\u0434\u0445\u0432\u0430\u0442\u044b\u0432\u0430\u044e\u0442\u0441\u044f \u043f\u043e\u0441\u043b\u0435 \u0431\u044b\u0441\u0442\u0440\u043e\u0439 \u043f\u0435\u0440\u0435\u0437\u0430\u0433\u0440\u0443\u0437\u043a\u0438 \u0441\u0446\u0435\u043d\u044b.</div>' +
      "</div>";
    root.setAttribute("aria-hidden", "false");
  }

  function openSettingsModal() {
    var root = getSettingsModalRoot();
    if (!root) {
      return;
    }
    root.setAttribute("aria-hidden", "false");
    root.innerHTML =
      '<div id="' +
      SETTINGS_PANEL_ID +
      '" class="pixel-office-settings-panel pixel-office-settings-loading" role="dialog" aria-modal="true">' +
      '<div class="pixel-office-settings-title">\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430 \u043d\u0430\u0441\u0442\u0440\u043e\u0435\u043a...</div>' +
      "</div>";
    fetchDesktopConfig()
      .then(function (payload) {
        renderSettingsModal(payload);
      })
      .catch(function (error) {
        renderSettingsModal({ externalAssetDirectories: [] });
        showOfficeHint(error && error.message ? error.message : "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u043d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438");
      });
  }

  function isSettingsButton(button) {
    if (!button) {
      return false;
    }
    var title = normalizeTitle(button.getAttribute("title") || "");
    var aria = normalizeTitle(button.getAttribute("aria-label") || "");
    var text = normalizeTitle(button.textContent || "");
    return (
      title === "Settings" ||
      title === "\u041d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438" ||
      aria === "Settings" ||
      aria === "\u041d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438" ||
      text === "Settings" ||
      text === "\u041d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438"
    );
  }

  function isEditorButton(button) {
    if (!button) {
      return false;
    }
    var title = normalizeTitle(button.getAttribute("title") || "");
    var aria = normalizeTitle(button.getAttribute("aria-label") || "");
    var text = normalizeTitle(button.textContent || "");
    return (
      title === "Edit office layout" ||
      title === "\u0418\u0437\u043c\u0435\u043d\u0438\u0442\u044c \u043e\u0444\u0438\u0441" ||
      aria === "Edit office layout" ||
      aria === "\u0418\u0437\u043c\u0435\u043d\u0438\u0442\u044c \u043e\u0444\u0438\u0441" ||
      text === "Layout" ||
      text === "\u0420\u0435\u0434\u0430\u043a\u0442\u043e\u0440"
    );
  }

  function openBuiltInSettings() {
    var buttons = document.querySelectorAll("button");
    for (var index = 0; index < buttons.length; index += 1) {
      var button = buttons[index];
      if (!isSettingsButton(button)) {
        continue;
      }
      if (button.closest && button.closest("#" + OFFICE_SWITCHER_ID)) {
        continue;
      }
      button.click();
      return true;
    }
    return false;
  }

  function openBuiltInEditor() {
    var buttons = document.querySelectorAll("button");
    for (var index = 0; index < buttons.length; index += 1) {
      var button = buttons[index];
      if (!isEditorButton(button)) {
        continue;
      }
      if (button.closest && button.closest("#" + OFFICE_SWITCHER_ID)) {
        continue;
      }
      button.click();
      return true;
    }
    return false;
  }

  function updateOfficeSwitcher() {
    var root = document.getElementById(OFFICE_SWITCHER_ID);
    if (!document.body) {
      return;
    }

    if (!root) {
      root = document.createElement("div");
      root.id = OFFICE_SWITCHER_ID;
      root.setAttribute("role", "group");
      root.setAttribute("aria-label", "\u0423\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u0438\u0435 \u043e\u0444\u0438\u0441\u043e\u043c");
      document.body.appendChild(root);
    }

    root.textContent = "";
    var activePreset = getActiveOfficePreset();
    getOfficePresets().forEach(function (preset) {
      var officeButton = document.createElement("button");
      officeButton.type = "button";
      officeButton.textContent = preset.label;
      officeButton.setAttribute("aria-pressed", activePreset.id === preset.id ? "true" : "false");
      styleOfficeSwitcherButton(officeButton, activePreset.id === preset.id);
      officeButton.addEventListener("click", function () {
        if (activePreset.id === preset.id) {
          return;
        }
        setActiveOfficePreset(preset.id);
        refreshOfficeLayouts();
        window.setTimeout(function () {
          window.location.reload();
        }, 60);
      });
      root.appendChild(officeButton);
    });

    var editorButton = document.createElement("button");
    editorButton.type = "button";
    editorButton.textContent = "\u0420\u0435\u0434\u0430\u043a\u0442\u043e\u0440";
    editorButton.setAttribute("data-role", "editor");
    styleOfficeSwitcherButton(editorButton, false);
    editorButton.addEventListener("click", function () {
      if (!openBuiltInEditor()) {
        showOfficeHint("\u0420\u0435\u0434\u0430\u043a\u0442\u043e\u0440 \u043e\u0444\u0438\u0441\u0430 \u043f\u043e\u043a\u0430 \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d");
      }
    });
    root.appendChild(editorButton);

    var settingsButton = document.createElement("button");
    settingsButton.type = "button";
    settingsButton.textContent = "\u041d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438";
    settingsButton.setAttribute("data-role", "settings");
    styleOfficeSwitcherButton(settingsButton, false);
    settingsButton.addEventListener("click", function () {
      openSettingsModal();
    });
    root.appendChild(settingsButton);
  }

  function ensureOfficeSwitcher() {
    bindOfficeHintListener();
    updateOfficeSwitcher();
  }

  seedGlobalOffice();
  upgradeKnownThreadKeys();
  wrapFetch();
  ensureDesktopHostPatch();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startTextSync, { once: true });
  } else {
    startTextSync();
  }

  try {
    var activeThread = window.localStorage.getItem(ACTIVE_THREAD_KEY);
    if (activeThread) {
      writeThreadOffice(activeThread);
    }
  } catch (error) {}
})();

