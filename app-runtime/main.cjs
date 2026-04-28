const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { URL } = require('node:url');
const { app, BrowserWindow, Menu, shell } = require('electron');
const { getRuntimeSnapshot, getThreadStateResponse, getThreadsResponse } = require('./codexRuntime.cjs');
const { handleDesktopApiRequest, handleDynamicAssetRequest } = require('./desktopOfficeApi.cjs');

const DIST_INDEX = path.join(__dirname, 'dist', 'webview', 'index.html');
const DIST_ROOT = path.dirname(DIST_INDEX);
const APP_ICON = path.join(__dirname, 'icon.png');
const FALLBACK_LOG_PATH = path.join(path.dirname(process.execPath), 'desktop-main.log');
let staticServer = null;

function isInternalAppUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol === 'data:') return true;
    if (parsed.protocol === 'about:') return true;
    return parsed.protocol === 'http:' && parsed.hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

function openExternalUrl(rawUrl) {
  if (!rawUrl || isInternalAppUrl(rawUrl)) return;
  void shell.openExternal(rawUrl).catch((error) => {
    appendDesktopLog(`openExternal:error url=${rawUrl} ${error?.stack || error}`);
  });
}

function appendLine(filePath, line) {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.appendFileSync(filePath, `[${new Date().toISOString()}] ${line}\n`, 'utf8');
  } catch {
    // Ignore logging failures.
  }
}

function appendDesktopLog(line) {
  appendLine(FALLBACK_LOG_PATH, line);
  try {
    appendLine(path.join(path.dirname(process.execPath), 'desktop-debug.log'), line);
  } catch {
    // Ignore logging failures.
  }
}

process.on('uncaughtException', (error) => {
  appendDesktopLog(`uncaughtException ${error?.stack || error}`);
});

process.on('unhandledRejection', (reason) => {
  appendDesktopLog(`unhandledRejection ${reason?.stack || reason}`);
});

appendDesktopLog(`main-module-loaded execPath=${process.execPath} distIndex=${DIST_INDEX}`);

function buildMissingMarkup() {
  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>Pixel Agents Desktop</title>
        <style>
          body {
            margin: 0;
            min-height: 100vh;
            display: grid;
            place-items: center;
            background: #131722;
            color: #f7edd6;
            font-family: "Segoe UI", sans-serif;
          }
          main {
            max-width: 720px;
            padding: 32px;
            border: 3px solid #4f5a7a;
            background: linear-gradient(180deg, #1a2030, #121725);
            box-shadow: 10px 10px 0 rgba(0, 0, 0, 0.35);
          }
          h1 {
            margin-top: 0;
            font-size: 28px;
            text-transform: uppercase;
            letter-spacing: 0.08em;
          }
        </style>
      </head>
      <body>
        <main>
          <h1>Pixel Agents Desktop</h1>
          <p>Built application is missing its web UI bundle.</p>
        </main>
      </body>
    </html>
  `;
}

function createWindow() {
  appendDesktopLog('createWindow:start');
  const window = new BrowserWindow({
    width: 1480,
    height: 980,
    minWidth: 1160,
    minHeight: 760,
    backgroundColor: '#141826',
    autoHideMenuBar: true,
    title: 'Pixel Agents Desktop',
    icon: fs.existsSync(APP_ICON) ? APP_ICON : undefined,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      spellcheck: false,
    },
    show: false,
  });

  let revealed = false;
  const revealWindow = () => {
    if (revealed || window.isDestroyed()) return;
    revealed = true;
    window.show();
    window.focus();
  };
  const revealTimer = setTimeout(revealWindow, 3000);
  window.once('ready-to-show', revealWindow);
  window.webContents.once('did-finish-load', revealWindow);
  window.on('closed', () => clearTimeout(revealTimer));
  window.on('show', () => appendDesktopLog('window:show'));
  window.on('unresponsive', () => appendDesktopLog('window:unresponsive'));
  window.on('responsive', () => appendDesktopLog('window:responsive'));
  window.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    appendDesktopLog(`renderer console level=${level} ${sourceId}:${line} ${message}`);
  });
  window.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    appendDesktopLog(`did-fail-load code=${errorCode} url=${validatedURL} ${errorDescription}`);
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    appendDesktopLog(`setWindowOpenHandler url=${url}`);
    if (isInternalAppUrl(url)) {
      return { action: 'allow' };
    }
    openExternalUrl(url);
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event, url) => {
    if (isInternalAppUrl(url)) return;
    appendDesktopLog(`will-navigate:external url=${url}`);
    event.preventDefault();
    openExternalUrl(url);
  });
  window.webContents.on('render-process-gone', (_event, details) => {
    appendDesktopLog(`render-process-gone reason=${details.reason} exitCode=${details.exitCode}`);
  });
  window.webContents.on('did-finish-load', () => {
    appendDesktopLog('did-finish-load');
    setTimeout(() => {
      if (window.isDestroyed()) return;
      void window.webContents
        .executeJavaScript(
          `JSON.stringify({
            href: location.href,
            title: document.title,
            text: document.body ? document.body.innerText.slice(0, 500) : '',
            canvasCount: document.querySelectorAll('canvas').length,
            buttonCount: document.querySelectorAll('button').length,
            rootChildren: document.getElementById('root') ? document.getElementById('root').children.length : -1
          })`,
          true,
        )
        .then((value) => appendDesktopLog(`dom-snapshot ${value}`))
        .catch((error) => appendDesktopLog(`dom-snapshot-error ${error?.message || error}`));
    }, 1500);
  });

  appendDesktopLog(`createWindow:loadFallback distExists=${fs.existsSync(DIST_INDEX)} server=${!!staticServer}`);
  void window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(buildMissingMarkup())}`);
  return window;
}

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.js') return 'application/javascript; charset=utf-8';
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.json') return 'application/json; charset=utf-8';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.svg') return 'image/svg+xml';
  if (ext === '.woff') return 'font/woff';
  if (ext === '.woff2') return 'font/woff2';
  return 'application/octet-stream';
}

function startStaticServer() {
  appendDesktopLog(`startStaticServer:begin distExists=${fs.existsSync(DIST_INDEX)}`);
  if (!fs.existsSync(DIST_INDEX)) return Promise.resolve(null);

  const server = http.createServer(async (req, res) => {
    const reqUrl = new URL(req.url || '/', 'http://127.0.0.1');

    if (reqUrl.pathname === '/api/runtime') {
      const snapshot = getRuntimeSnapshot();
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-cache' });
      res.end(
        JSON.stringify({
          mode: snapshot.mode,
          currentThreadId: snapshot.currentThreadId,
        }),
      );
      return;
    }

    if (reqUrl.pathname === '/api/threads') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-cache' });
      res.end(JSON.stringify(getThreadsResponse()));
      return;
    }

    if (reqUrl.pathname.startsWith('/api/thread-state/')) {
      const threadId = decodeURIComponent(reqUrl.pathname.slice('/api/thread-state/'.length));
      const state = getThreadStateResponse(threadId);
      if (!state) {
        res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'Thread not found' }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-cache' });
      res.end(JSON.stringify(state));
      return;
    }

    try {
      if (handleDynamicAssetRequest(reqUrl, res)) {
        return;
      }
    } catch (error) {
      appendDesktopLog(`dynamic-asset:error ${error?.stack || error}`);
      res.writeHead(error instanceof URIError ? 400 : 500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: false, error: error instanceof URIError ? 'Invalid asset path' : 'Asset request error' }));
      return;
    }

    try {
      const desktopApiHandled = await handleDesktopApiRequest(
        req,
        res,
        reqUrl,
        () => BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0] || null,
      );
      if (desktopApiHandled) {
        return;
      }
    } catch (error) {
      appendDesktopLog(`desktop-api:error ${error?.stack || error}`);
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: false, error: 'Desktop API error' }));
      return;
    }

    const relativePath = reqUrl.pathname === '/' ? '/index.html' : reqUrl.pathname;
    const normalizedPath = path.normalize(relativePath).replace(/^(\.\.[\\/])+/, '');
    const filePath = path.join(DIST_ROOT, normalizedPath);

    if (!filePath.startsWith(DIST_ROOT)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    fs.readFile(filePath, (error, data) => {
      if (error) {
        res.writeHead(error.code === 'ENOENT' ? 404 : 500);
        res.end(error.code === 'ENOENT' ? 'Not found' : 'Server error');
        return;
      }
      res.writeHead(200, { 'Content-Type': contentTypeFor(filePath), 'Cache-Control': 'no-cache' });
      res.end(data);
    });
  });

  return new Promise((resolve, reject) => {
    server.once('error', (error) => {
      appendDesktopLog(`startStaticServer:error ${error?.stack || error}`);
      reject(error);
    });
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      appendDesktopLog(`startStaticServer:listening port=${server.address().port}`);
      resolve(server);
    });
  });
}

app.whenReady().then(async () => {
  appendDesktopLog('app:whenReady');
  Menu.setApplicationMenu(null);
  app.setAppUserModelId('pixel-agents.desktop');
  app.setName('Pixel Agents Desktop');
  const window = createWindow();
  try {
    staticServer = await startStaticServer();
    appendDesktopLog(`app:serverReady hasServer=${!!staticServer}`);
    if (fs.existsSync(DIST_INDEX) && staticServer && !window.isDestroyed()) {
      appendDesktopLog(`app:loadLiveUI http://127.0.0.1:${staticServer.address().port}/index.html`);
      void window.loadURL(`http://127.0.0.1:${staticServer.address().port}/index.html`);
    }
  } catch (error) {
    appendDesktopLog(`app:startStaticServerFailed ${error?.stack || error}`);
  }

  app.on('activate', () => {
    appendDesktopLog('app:activate');
    if (BrowserWindow.getAllWindows().length === 0) {
      const nextWindow = createWindow();
      if (fs.existsSync(DIST_INDEX) && staticServer && !nextWindow.isDestroyed()) {
        appendDesktopLog(`app:activateLoadLiveUI http://127.0.0.1:${staticServer.address().port}/index.html`);
        void nextWindow.loadURL(`http://127.0.0.1:${staticServer.address().port}/index.html`);
      }
    }
  });
});

app.on('window-all-closed', () => {
  appendDesktopLog('app:window-all-closed');
  if (staticServer) {
    staticServer.close();
    staticServer = null;
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
