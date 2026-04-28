const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { dialog, shell } = require('electron');

const PIXEL_CONFIG_DIR = path.join(os.homedir(), '.pixel-agents');
const PIXEL_CONFIG_PATH = path.join(PIXEL_CONFIG_DIR, 'config.json');
const CODEX_ROOT = path.join(os.homedir(), '.codex');
const SESSIONS_ROOT = path.join(CODEX_ROOT, 'sessions');
const WEBVIEW_ASSETS_ROOT = path.join(__dirname, 'dist', 'webview', 'assets');
const BASE_ASSET_INDEX_PATH = path.join(WEBVIEW_ASSETS_ROOT, 'asset-index.json');
const BASE_FURNITURE_CATALOG_PATH = path.join(WEBVIEW_ASSETS_ROOT, 'furniture-catalog.json');
const ALLOW_DIRECT_PATH_MODE = process.env.PIXEL_AGENTS_ENABLE_TEST_PATH_IO === '1';

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.json') return 'application/json; charset=utf-8';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.svg') return 'image/svg+xml';
  return 'application/octet-stream';
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-cache',
  });
  res.end(JSON.stringify(payload));
}

function sendError(res, statusCode, message) {
  sendJson(res, statusCode, { ok: false, error: message });
}

function ensureParentDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function parseJsonText(rawText) {
  return JSON.parse(String(rawText || '').replace(/^\uFEFF/, ''));
}

function readJsonFileSafe(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return parseJsonText(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJsonFileAtomic(filePath, value) {
  ensureParentDir(filePath);
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(value, null, 2), 'utf8');
  fs.renameSync(tmpPath, filePath);
}

function readDesktopConfig() {
  const parsed = readJsonFileSafe(PIXEL_CONFIG_PATH, {});
  return {
    externalAssetDirectories: Array.isArray(parsed && parsed.externalAssetDirectories)
      ? parsed.externalAssetDirectories.filter((value) => typeof value === 'string')
      : [],
  };
}

function writeDesktopConfig(config) {
  writeJsonFileAtomic(PIXEL_CONFIG_PATH, {
    externalAssetDirectories: Array.isArray(config.externalAssetDirectories)
      ? config.externalAssetDirectories
      : [],
  });
}

function hashString(input) {
  let hash = 2166136261;
  const text = String(input || '');
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function isDirectory(filePath) {
  try {
    return fs.existsSync(filePath) && fs.statSync(filePath).isDirectory();
  } catch {
    return false;
  }
}

function normalizeAssetRoot(rawPath) {
  if (typeof rawPath !== 'string' || !rawPath.trim()) return null;
  const resolved = path.resolve(rawPath.trim());
  const baseName = path.basename(resolved).toLowerCase();
  if (
    baseName === 'assets' &&
    (isDirectory(path.join(resolved, 'characters')) || isDirectory(path.join(resolved, 'furniture')))
  ) {
    return path.dirname(resolved);
  }
  return resolved;
}

function resolveDirectPathInput(rawPath) {
  if (!ALLOW_DIRECT_PATH_MODE) return null;
  if (typeof rawPath !== 'string' || !rawPath.trim()) return null;
  return path.resolve(rawPath.trim());
}

function resolveAssetContentRoot(rootPath) {
  const resolvedRoot = path.resolve(String(rootPath || ''));
  const nestedAssetsDir = path.join(resolvedRoot, 'assets');
  if (
    isDirectory(nestedAssetsDir) &&
    (isDirectory(path.join(nestedAssetsDir, 'characters')) ||
      isDirectory(path.join(nestedAssetsDir, 'furniture')))
  ) {
    return nestedAssetsDir;
  }
  if (
    isDirectory(path.join(resolvedRoot, 'characters')) ||
    isDirectory(path.join(resolvedRoot, 'furniture'))
  ) {
    return resolvedRoot;
  }
  return null;
}

function countCharacterFiles(charactersDir) {
  if (!isDirectory(charactersDir)) return 0;
  try {
    return fs.readdirSync(charactersDir).filter((fileName) => /^char_\d+\.png$/i.test(fileName)).length;
  } catch {
    return 0;
  }
}

function countFurnitureManifests(furnitureDir) {
  if (!isDirectory(furnitureDir)) return 0;
  try {
    return fs
      .readdirSync(furnitureDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(furnitureDir, entry.name, 'manifest.json')))
      .length;
  } catch {
    return 0;
  }
}

function inspectAssetRoot(rawPath) {
  const root = normalizeAssetRoot(rawPath);
  if (!root || !fs.existsSync(root)) {
    return { ok: false, error: 'Asset folder was not found.' };
  }

  const contentRoot = resolveAssetContentRoot(root);
  if (!contentRoot) {
    return {
      ok: false,
      error: 'The selected folder does not contain assets/characters or assets/furniture.',
    };
  }

  const charactersDir = path.join(contentRoot, 'characters');
  const furnitureDir = path.join(contentRoot, 'furniture');
  const characterCount = countCharacterFiles(charactersDir);
  const furnitureManifestCount = countFurnitureManifests(furnitureDir);
  const hasCharacters = characterCount > 0;
  const hasFurniture = furnitureManifestCount > 0;

  if (!hasCharacters && !hasFurniture) {
    return {
      ok: false,
      error: 'The selected folder does not contain usable char_*.png files or furniture manifests.',
    };
  }

  return {
    ok: true,
    root,
    contentRoot,
    charactersDir,
    furnitureDir,
    id: hashString(root),
    hasCharacters,
    hasFurniture,
    characterCount,
    furnitureManifestCount,
  };
}

function getExternalRoots() {
  const seen = new Set();
  const roots = [];
  for (const rawPath of readDesktopConfig().externalAssetDirectories) {
    const details = inspectAssetRoot(rawPath);
    if (!details.ok || seen.has(details.root)) continue;
    seen.add(details.root);
    roots.push(details);
  }
  return roots;
}

function toEncodedPosixPath(...parts) {
  return parts
    .filter(Boolean)
    .join('/')
    .replace(/\\/g, '/')
    .split('/')
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join('/');
}

function flattenManifest(node, inherited) {
  if (!node || typeof node !== 'object') {
    return [];
  }

  if (node.type === 'asset') {
    const orientation = node.orientation || inherited.orientation;
    const state = node.state || inherited.state;
    return [
      {
        id: node.id,
        name: inherited.name,
        label: inherited.name,
        category: inherited.category,
        file: node.file,
        width: node.width,
        height: node.height,
        footprintW: node.footprintW,
        footprintH: node.footprintH,
        isDesk: inherited.category === 'desks',
        canPlaceOnWalls: inherited.canPlaceOnWalls,
        canPlaceOnSurfaces: inherited.canPlaceOnSurfaces,
        backgroundTiles: inherited.backgroundTiles,
        groupId: inherited.groupId,
        ...(orientation ? { orientation } : {}),
        ...(state ? { state } : {}),
        ...(node.mirrorSide ? { mirrorSide: true } : {}),
        ...(inherited.rotationScheme ? { rotationScheme: inherited.rotationScheme } : {}),
        ...(inherited.animationGroup ? { animationGroup: inherited.animationGroup } : {}),
        ...(node.frame !== undefined ? { frame: node.frame } : {}),
      },
    ];
  }

  const results = [];
  const members = Array.isArray(node.members) ? node.members : [];

  for (const member of members) {
    const childProps = { ...inherited };

    if (node.groupType === 'rotation' && node.rotationScheme) {
      childProps.rotationScheme = node.rotationScheme;
    }

    if (node.groupType === 'state') {
      if (node.orientation) childProps.orientation = node.orientation;
      if (node.state) childProps.state = node.state;
    }

    if (node.groupType === 'animation') {
      const orient = node.orientation || inherited.orientation || '';
      const state = node.state || inherited.state || '';
      childProps.animationGroup = `${inherited.groupId}_${orient}_${state}`.toUpperCase();
      if (node.state) childProps.state = node.state;
    }

    if (node.orientation && !childProps.orientation) {
      childProps.orientation = node.orientation;
    }

    results.push(...flattenManifest(member, childProps));
  }

  return results;
}

function buildExternalFurnitureCatalog() {
  const catalog = [];

  for (const root of getExternalRoots()) {
    if (!root.hasFurniture) continue;
    const furnitureDir = root.furnitureDir;
    let entries = [];
    try {
      entries = fs.readdirSync(furnitureDir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const itemDir = path.join(furnitureDir, entry.name);
      const manifestPath = path.join(itemDir, 'manifest.json');
      if (!fs.existsSync(manifestPath)) continue;

      let manifest;
      try {
        manifest = parseJsonText(fs.readFileSync(manifestPath, 'utf8'));
      } catch {
        continue;
      }

      const inherited = {
        groupId: manifest.id,
        name: manifest.name,
        category: manifest.category,
        canPlaceOnWalls: !!manifest.canPlaceOnWalls,
        canPlaceOnSurfaces: !!manifest.canPlaceOnSurfaces,
        backgroundTiles: Number.isFinite(manifest.backgroundTiles) ? manifest.backgroundTiles : 0,
      };

      let assets = [];
      if (manifest.type === 'asset') {
        assets = [
          {
            id: manifest.id,
            name: manifest.name,
            label: manifest.name,
            category: manifest.category,
            file: manifest.file || `${manifest.id}.png`,
            width: manifest.width,
            height: manifest.height,
            footprintW: manifest.footprintW,
            footprintH: manifest.footprintH,
            isDesk: manifest.category === 'desks',
            canPlaceOnWalls: !!manifest.canPlaceOnWalls,
            canPlaceOnSurfaces: !!manifest.canPlaceOnSurfaces,
            backgroundTiles: Number.isFinite(manifest.backgroundTiles) ? manifest.backgroundTiles : 0,
            groupId: manifest.id,
          },
        ];
      } else if (manifest.type === 'group') {
        if (manifest.rotationScheme) {
          inherited.rotationScheme = manifest.rotationScheme;
        }
        assets = flattenManifest(
          {
            type: 'group',
            groupType: manifest.groupType,
            rotationScheme: manifest.rotationScheme,
            members: Array.isArray(manifest.members) ? manifest.members : [],
          },
          inherited,
        );
      }

      for (const asset of assets) {
        const relativeFilePath = toEncodedPosixPath(entry.name, asset.file);
        catalog.push({
          ...asset,
          furniturePath: `external-furniture/${root.id}/${relativeFilePath}`,
        });
      }
    }
  }

  return catalog;
}

function buildExternalCharacterEntries() {
  const entries = [];

  for (const root of getExternalRoots()) {
    if (!root.hasCharacters) continue;
    const charactersDir = root.charactersDir;
    let files = [];
    try {
      files = fs.readdirSync(charactersDir);
    } catch {
      continue;
    }

    files
      .filter((fileName) => /^char_\d+\.png$/i.test(fileName))
      .sort((left, right) => {
        const leftIndex = Number(left.match(/\d+/)?.[0] || 0);
        const rightIndex = Number(right.match(/\d+/)?.[0] || 0);
        return leftIndex - rightIndex;
      })
      .forEach((fileName) => {
        entries.push(`external-characters/${root.id}/${encodeURIComponent(fileName)}`);
      });
  }

  return entries;
}

function buildMergedAssetIndex() {
  const base = readJsonFileSafe(BASE_ASSET_INDEX_PATH, {
    floors: [],
    walls: [],
    characters: [],
    defaultLayout: 'default-layout-1.json',
  });
  const extraCharacters = buildExternalCharacterEntries();
  return {
    ...base,
    characters: [...(Array.isArray(base.characters) ? base.characters : []), ...extraCharacters],
  };
}

function buildMergedFurnitureCatalog() {
  const base = readJsonFileSafe(BASE_FURNITURE_CATALOG_PATH, []);
  const external = buildExternalFurnitureCatalog();
  const overrideIds = new Set(external.map((item) => item.id));
  const dedupedBase = Array.isArray(base)
    ? base.filter((item) => item && !overrideIds.has(item.id))
    : [];
  return [...dedupedBase, ...external];
}

function resolveSafeFile(baseDir, relativePath) {
  try {
    const resolvedBase = fs.realpathSync.native
      ? fs.realpathSync.native(baseDir)
      : fs.realpathSync(baseDir);
    const resolvedFile = path.resolve(resolvedBase, relativePath);
    if (!fs.existsSync(resolvedFile)) {
      return null;
    }
    const realFile = fs.realpathSync.native
      ? fs.realpathSync.native(resolvedFile)
      : fs.realpathSync(resolvedFile);
    if (!realFile.startsWith(`${resolvedBase}${path.sep}`) && realFile !== resolvedBase) {
      return null;
    }
    return realFile;
  } catch {
    return null;
  }
}

function parseDynamicAssetPath(reqUrl) {
  const pathname = reqUrl.pathname;
  if (pathname === '/assets/asset-index.json') {
    return { type: 'asset-index' };
  }
  if (pathname === '/assets/furniture-catalog.json') {
    return { type: 'furniture-catalog' };
  }
  if (pathname.startsWith('/assets/external-characters/')) {
    const parts = pathname
      .slice('/assets/external-characters/'.length)
      .split('/')
      .filter(Boolean)
      .map((value) => decodeURIComponent(value));
    if (parts.length >= 2) {
      return {
        type: 'external-character',
        rootId: parts.shift(),
        relativePath: parts.join(path.sep),
      };
    }
  }
  if (pathname.startsWith('/assets/external-furniture/')) {
    const parts = pathname
      .slice('/assets/external-furniture/'.length)
      .split('/')
      .filter(Boolean)
      .map((value) => decodeURIComponent(value));
    if (parts.length >= 3) {
      return {
        type: 'external-furniture',
        rootId: parts.shift(),
        relativePath: parts.join(path.sep),
      };
    }
  }
  return null;
}

function serveFile(res, filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    sendError(res, 404, 'Asset not found.');
    return true;
  }

  try {
    const data = fs.readFileSync(filePath);
    res.writeHead(200, {
      'Content-Type': contentTypeFor(filePath),
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  } catch {
    sendError(res, 500, 'Failed to read asset file.');
  }
  return true;
}

function handleDynamicAssetRequest(reqUrl, res) {
  const target = parseDynamicAssetPath(reqUrl);
  if (!target) return false;

  if (target.type === 'asset-index') {
    sendJson(res, 200, buildMergedAssetIndex());
    return true;
  }

  if (target.type === 'furniture-catalog') {
    sendJson(res, 200, buildMergedFurnitureCatalog());
    return true;
  }

  const root = getExternalRoots().find((entry) => entry.id === target.rootId);
  if (!root) {
    sendError(res, 404, 'External asset root not found.');
    return true;
  }

  if (target.type === 'external-character') {
    const charactersDir = root.charactersDir;
    return serveFile(res, resolveSafeFile(charactersDir, target.relativePath));
  }

  if (target.type === 'external-furniture') {
    const furnitureDir = root.furnitureDir;
    return serveFile(res, resolveSafeFile(furnitureDir, target.relativePath));
  }

  return false;
}

function readRequestJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;

    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 5 * 1024 * 1024) {
        reject(new Error('Payload too large.'));
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new Error('Invalid JSON body.'));
      }
    });

    req.on('error', reject);
  });
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function validateLayout(layout) {
  if (!layout || typeof layout !== 'object') {
    return 'Layout payload missing.';
  }
  if (layout.version !== 1) {
    return 'Layout version must be 1.';
  }
  if (!isFiniteNumber(layout.cols) || !isFiniteNumber(layout.rows)) {
    return 'Layout cols/rows are invalid.';
  }
  if (!Array.isArray(layout.tiles) || layout.tiles.length !== layout.cols * layout.rows) {
    return 'Layout tiles array is invalid.';
  }
  if (layout.tileColors && (!Array.isArray(layout.tileColors) || layout.tileColors.length !== layout.tiles.length)) {
    return 'Layout tileColors array is invalid.';
  }
  if (layout.furniture && !Array.isArray(layout.furniture)) {
    return 'Layout furniture array is invalid.';
  }
  return null;
}

function getDialogWindow(getWindow) {
  if (typeof getWindow !== 'function') return undefined;
  try {
    return getWindow() || undefined;
  } catch {
    return undefined;
  }
}

async function handleDesktopApiRequest(req, res, reqUrl, getWindow) {
  if (!reqUrl.pathname.startsWith('/api/desktop/')) {
    return false;
  }

  const window = getDialogWindow(getWindow);

  if (req.method === 'GET' && reqUrl.pathname === '/api/desktop/config') {
    sendJson(res, 200, {
      ok: true,
      externalAssetDirectories: readDesktopConfig().externalAssetDirectories,
    });
    return true;
  }

  if (req.method === 'POST' && reqUrl.pathname === '/api/desktop/open-sessions-folder') {
    const targetPath = fs.existsSync(SESSIONS_ROOT) ? SESSIONS_ROOT : CODEX_ROOT;
    const errorMessage = await shell.openPath(targetPath);
    if (errorMessage) {
      sendError(res, 500, errorMessage);
    } else {
      sendJson(res, 200, { ok: true, path: targetPath });
    }
    return true;
  }

  if (req.method === 'POST' && reqUrl.pathname === '/api/desktop/export-layout') {
    let payload;
    try {
      payload = await readRequestJson(req);
    } catch (error) {
      sendError(res, 400, error.message || 'Invalid request body.');
      return true;
    }

    const validationError = validateLayout(payload.layout);
    if (validationError) {
      sendError(res, 400, validationError);
      return true;
    }

    const filePath =
      resolveDirectPathInput(payload.path) ||
      (await (async () => {
            const defaultPath = path.join(os.homedir(), 'Downloads', 'pixel-agents-office.json');
            const result = await dialog.showSaveDialog(window, {
              defaultPath,
              filters: [{ name: 'JSON Files', extensions: ['json'] }],
            });
            if (result.canceled || !result.filePath) {
              return null;
            }
            return result.filePath;
          })());

    if (!filePath) {
      sendJson(res, 200, { ok: false, cancelled: true });
      return true;
    }

    try {
      ensureParentDir(filePath);
      fs.writeFileSync(filePath, JSON.stringify(payload.layout, null, 2), 'utf8');
      sendJson(res, 200, { ok: true, filePath });
    } catch {
      sendError(res, 500, 'Could not save the office file.');
    }
    return true;
  }

  if (req.method === 'POST' && reqUrl.pathname === '/api/desktop/import-layout') {
    let payload;
    try {
      payload = await readRequestJson(req);
    } catch (error) {
      sendError(res, 400, error.message || 'Invalid request body.');
      return true;
    }

    const selectedPath =
      resolveDirectPathInput(payload.path) ||
      (await (async () => {
            const result = await dialog.showOpenDialog(window, {
              canSelectMany: false,
              filters: [{ name: 'JSON Files', extensions: ['json'] }],
            });
            if (result.canceled || !result.filePaths.length) {
              return null;
            }
            return result.filePaths[0];
          })());

    if (!selectedPath) {
      sendJson(res, 200, { ok: false, cancelled: true });
      return true;
    }

    try {
      const raw = fs.readFileSync(selectedPath, 'utf8');
      const layout = parseJsonText(raw);
      const validationError = validateLayout(layout);
      if (validationError) {
        sendError(res, 400, validationError);
        return true;
      }
      sendJson(res, 200, {
        ok: true,
        filePath: selectedPath,
        layout,
      });
    } catch {
      sendError(res, 400, 'Could not read or parse the office JSON file.');
    }
    return true;
  }

  if (req.method === 'POST' && reqUrl.pathname === '/api/desktop/add-asset-directory') {
    let payload;
    try {
      payload = await readRequestJson(req);
    } catch (error) {
      sendError(res, 400, error.message || 'Invalid request body.');
      return true;
    }

    const selectedPath =
      resolveDirectPathInput(payload.path) ||
      (await (async () => {
            const result = await dialog.showOpenDialog(window, {
              canSelectFolders: true,
              canSelectFiles: false,
              canSelectMany: false,
              openLabel: 'Choose asset folder',
            });
            if (result.canceled || !result.filePaths.length) {
              return null;
            }
            return result.filePaths[0];
          })());

    if (!selectedPath) {
      sendJson(res, 200, { ok: false, cancelled: true });
      return true;
    }

    const details = inspectAssetRoot(selectedPath);
    if (!details.ok) {
      sendError(res, 400, details.error);
      return true;
    }

    const config = readDesktopConfig();
    if (!config.externalAssetDirectories.includes(details.root)) {
      config.externalAssetDirectories.push(details.root);
      writeDesktopConfig(config);
    }

    sendJson(res, 200, {
      ok: true,
      addedPath: details.root,
      externalAssetDirectories: readDesktopConfig().externalAssetDirectories,
    });
    return true;
  }

  if (req.method === 'POST' && reqUrl.pathname === '/api/desktop/remove-asset-directory') {
    let payload;
    try {
      payload = await readRequestJson(req);
    } catch (error) {
      sendError(res, 400, error.message || 'Invalid request body.');
      return true;
    }

    const targetPath = normalizeAssetRoot(payload.path);
    if (!targetPath) {
      sendError(res, 400, 'Не передан путь папки ассетов.');
      return true;
    }

    const config = readDesktopConfig();
    config.externalAssetDirectories = config.externalAssetDirectories.filter(
      (entry) => normalizeAssetRoot(entry) !== targetPath,
    );
    writeDesktopConfig(config);

    sendJson(res, 200, {
      ok: true,
      externalAssetDirectories: readDesktopConfig().externalAssetDirectories,
    });
    return true;
  }

  sendError(res, 404, 'Unknown desktop API endpoint.');
  return true;
}

module.exports = {
  handleDesktopApiRequest,
  handleDynamicAssetRequest,
};
