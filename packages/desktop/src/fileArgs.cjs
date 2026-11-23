const fs = require('node:fs');
const path = require('node:path');

/**
 * Extract existing file paths passed via OS command-line arguments.
 * Skips the executable itself, Electron internal flags, and the app entry script.
 */
function extractFilePathsFromArgv(argv, cwd = process.cwd(), appEntryPath = '') {
  if (!Array.isArray(argv)) return [];
  const normalizedEntry = appEntryPath ? path.resolve(appEntryPath) : '';
  const result = [];
  const seen = new Set();

  // In packaged apps argv[0] is the executable; in dev argv[0] is electron and argv[1] is app path.
  for (let i = 1; i < argv.length; i += 1) {
    const arg = argv[i];
    if (typeof arg !== 'string') continue;
    const trimmed = arg.trim();
    if (!trimmed || trimmed.startsWith('-')) continue;
    if (trimmed === '.' || trimmed.startsWith('app://') || trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      continue;
    }

    const resolved = path.resolve(cwd, trimmed);
    if (normalizedEntry && resolved === normalizedEntry) continue;
    if (resolved.endsWith('.cjs') || resolved.endsWith('.mjs') || resolved.endsWith('app.asar')) {
      continue;
    }

    try {
      const stat = fs.statSync(resolved);
      if (stat.isFile() && !seen.has(resolved)) {
        seen.add(resolved);
        result.push(resolved);
      }
    } catch {
      // Ignore non-existent paths or flags mistaken for paths
    }
  }

  return result;
}

const MIME_BY_EXT = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.onnx': 'application/octet-stream',
  '.ort': 'application/octet-stream',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

function mimeTypeForPath(filePath) {
  const lower = String(filePath).toLowerCase();
  if (lower.endsWith('.wasm.br')) {
    return 'application/wasm';
  }
  const ext = path.extname(lower);
  return MIME_BY_EXT[ext] || 'application/octet-stream';
}

/**
 * Resolve a request URL against `distRoot`, falling back to `index.html` for SPA routes.
 * Prevents path traversal outside `distRoot`.
 */
function resolveDistAsset(distRoot, requestUrl) {
  const root = path.resolve(distRoot);
  const parsed = new URL(requestUrl);
  const decodedPath = decodeURIComponent(parsed.pathname || '/');
  const relative = decodedPath.replace(/^\/+/, '');
  const candidate = path.resolve(root, relative || 'index.html');

  if (candidate !== root && !candidate.startsWith(root + path.sep)) {
    return null;
  }

  try {
    const stat = fs.statSync(candidate);
    if (stat.isFile()) return candidate;
  } catch {
    // Fall through to SPA index.html fallback when pathname has no file extension
  }

  if (!path.extname(candidate)) {
    const indexHtml = path.join(root, 'index.html');
    try {
      if (fs.statSync(indexHtml).isFile()) return indexHtml;
    } catch {
      return null;
    }
  }

  return null;
}

module.exports = {
  extractFilePathsFromArgv,
  mimeTypeForPath,
  resolveDistAsset,
};
