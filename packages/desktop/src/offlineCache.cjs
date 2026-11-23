const crypto = require('node:crypto');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const zlib = require('node:zlib');
const { mimeTypeForPath } = require('./fileArgs.cjs');
const {
  padFontThumbnailSpriteBin,
  patchAllFontsSource,
} = require('./koreanFontsPatch.cjs');

/**
 * Core assets to warm in the background if any asset was not pre-bundled.
 */
const OFFICE_CORE_PATHS = [
  '/editor?embed=1&locale=ko',
  '/web-apps/apps/api/documents/api.js',
  '/sdkjs/common/AllFonts.js',
  '/sdkjs/common/libfont/engine/fonts.js',
  '/sdkjs/common/libfont/engine/fonts.wasm',
  '/sdkjs/common/wasm/x2t/x2t.js',
  '/sdkjs/common/wasm/x2t/x2t.wasm.br',
  '/fonts/059',
  '/fonts/060',
  '/fonts/061',
  '/fonts/062',
  '/fonts/109',
  '/fonts/110',
  '/fonts/111',
  '/fonts/112',
  '/fonts/181',
  '/fonts/182',
  '/fonts/183',
  '/fonts/184',
  '/fonts/185',
  '/fonts/186',
  '/fonts/187',
  '/web-apps/apps/documenteditor/main/index.html',
  '/web-apps/apps/documenteditor/main/app.js',
  '/web-apps/apps/documenteditor/main/code.js',
  '/sdkjs/word/sdk-all-min.js',
  '/sdkjs/word/sdk-all.js',
  '/web-apps/apps/spreadsheeteditor/main/index.html',
  '/web-apps/apps/spreadsheeteditor/main/app.js',
  '/web-apps/apps/spreadsheeteditor/main/code.js',
  '/sdkjs/cell/sdk-all-min.js',
  '/sdkjs/cell/sdk-all.js',
  '/web-apps/apps/presentationeditor/main/index.html',
  '/web-apps/apps/presentationeditor/main/app.js',
  '/web-apps/apps/presentationeditor/main/code.js',
  '/sdkjs/slide/sdk-all-min.js',
  '/sdkjs/slide/sdk-all.js',
  '/sdkjs/pdf/sdk-all-min.js',
  '/sdkjs/pdf/sdk-all.js',
];

function cacheKeyForUrl(rawUrl) {
  const u = new URL(rawUrl);
  // Normalize editor bootstrap queries so offline reload with any embedOrigin hits the same cache
  const isEditorRoot =
    (u.hostname === 'editor.sejong.dev' && /^\/editor(?:\.html)?\/?$/.test(u.pathname)) ||
    (u.hostname === 'sejongy00.github.io' && /^\/rhwp\/?(?:index\.html)?$/.test(u.pathname));
  const canonical = isEditorRoot
    ? `${u.origin}${u.pathname}`
    : `${u.origin}${u.pathname}${u.search}`;
  const hash = crypto.createHash('sha256').update(canonical).digest('hex');
  return {
    canonical,
    bodyPath: `${hash}.bin`,
    metaPath: `${hash}.json`,
  };
}

function safeResolveFile(allowedRoot, relativePath) {
  const cleanRel = relativePath.replace(/^\/+/, '');
  if (!cleanRel) return null;
  const root = path.resolve(allowedRoot);
  const candidate = path.resolve(root, cleanRel);
  if (!candidate.startsWith(root + path.sep)) return null;
  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
    return candidate;
  }
  return null;
}

/**
 * Resolve bundled offline assets inside `dist/offline-office/`, `dist/offline-rhwp/`, and `dist/fonts/`
 * so the desktop app works 100% offline immediately after installation with zero internet access.
 */
function resolveBundledOfficeAsset(distRoot, rawUrl) {
  try {
    const u = new URL(rawUrl);
    const pathname = decodeURIComponent(u.pathname || '/');

    // 0. Shared decoded Korean TTFs (`/fonts/Nanum*.ttf` or `/rhwp/fonts/Nanum*.ttf`) -> `dist/fonts/Nanum*.ttf`
    const nanumMatch = pathname.match(/\/(Nanum[A-Za-z0-9_-]+\.ttf)$/);
    if (nanumMatch) {
      const sharedTtf = safeResolveFile(path.resolve(distRoot, 'fonts'), nanumMatch[1]);
      if (sharedTtf) return sharedTtf;
    }

    // 1. OnlyOffice (`https://editor.sejong.dev/...`)
    if (u.hostname === 'editor.sejong.dev') {
      const officeRoot = path.resolve(distRoot, 'offline-office');
      if (/^\/editor(?:\.html)?\/?$/.test(pathname)) {
        const editorHtml = safeResolveFile(officeRoot, 'editor.html');
        if (editorHtml) return editorHtml;
      }
      if (pathname === '/' || pathname === '/index.html') {
        const indexHtml =
          safeResolveFile(officeRoot, 'index.html') ||
          safeResolveFile(officeRoot, 'editor.html');
        if (indexHtml) return indexHtml;
      }

      const directHit = safeResolveFile(officeRoot, pathname);
      if (directHit) return directHit;

      // Fallback for unbundled exotic font catalog slots (/fonts/NNN) -> NanumGothic (183) or Liberation Sans (062)
      if (/^\/fonts\/\d{3}$/.test(pathname)) {
        return (
          safeResolveFile(officeRoot, 'fonts/183') ||
          safeResolveFile(officeRoot, 'fonts/062')
        );
      }
      return null;
    }

    // 2. RHWP Studio (`https://sejongy00.github.io/rhwp/...`)
    if (u.hostname === 'sejongy00.github.io' && /^\/rhwp(?:\/|$)/.test(pathname)) {
      const rhwpRoot = path.resolve(distRoot, 'offline-rhwp');
      const subPath = pathname.replace(/^\/rhwp\/?/, '') || 'index.html';
      const directHit = safeResolveFile(rhwpRoot, subPath);
      if (directHit) return directHit;

      // Fallback unhashed rhwp_bg.wasm to the hashed assets/rhwp_bg-*.wasm bundle
      if (subPath === 'rhwp_bg.wasm') {
        const assetsDir = path.join(rhwpRoot, 'assets');
        if (fs.existsSync(assetsDir)) {
          const hashed = fs
            .readdirSync(assetsDir)
            .find((name) => /^rhwp_bg-[A-Za-z0-9_-]+\.wasm$/.test(name));
          if (hashed) return safeResolveFile(assetsDir, hashed);
        }
      }
      return null;
    }

    // 3. RHWP external CDN font requests (`https://cdn.jsdelivr.net/...`) -> Bundled Korean TTFs
    if (u.hostname === 'cdn.jsdelivr.net' && /\.(?:woff2?|ttf|otf)$/i.test(pathname)) {
      const fontsRoot = path.resolve(distRoot, 'fonts');
      const isBold = /bold|-700-|-800-|squareb/i.test(pathname);
      let chosen = isBold ? 'NanumGothic-Bold.ttf' : 'NanumGothic-Regular.ttf';
      if (/batang|myeongjo|myungjo|serif|song-myung|fangsong|simsun|baskerville|bodoni|garamond/i.test(pathname)) {
        chosen = 'NanumMyeongjo-Regular.ttf';
      } else if (/barun|dotum|hcrdotum/i.test(pathname)) {
        chosen = isBold ? 'NanumBarunGothic-Bold.ttf' : 'NanumBarunGothic-Regular.ttf';
      } else if (/square/i.test(pathname)) {
        chosen = isBold ? 'NanumSquare-Bold.ttf' : 'NanumSquare-Regular.ttf';
      }
      return (
        safeResolveFile(fontsRoot, chosen) ||
        safeResolveFile(path.resolve(distRoot, 'offline-office/fonts'), chosen)
      );
    }
  } catch {
    // Ignore malformed URLs
  }
  return null;
}

/**
 * Patch RHWP Studio's embed origin validator so the Electron desktop shell (`app://bundle`)
 * can complete the `@rhwp/editor` handshake (`rhwp-connect` / `loadFile`) and save shortcuts.
 */
function patchRhwpOriginCheck(source) {
  if (typeof source !== 'string') {
    return source;
  }
  return source.replace(
    /new URL\(([A-Za-z_$][\w$]*)\)\.protocol;return ([A-Za-z_$][\w$]*)===([`'"])http:\3\|\|\2===\3https:\3(?!\|\|\2===\3app:\3)/g,
    'new URL($1).protocol;return $2===$3http:$3||$2===$3https:$3||$2===$3app:$3',
  );
}

function transformOfficePayload(rawUrl, bodyBuffer, contentType) {
  try {
    const u = new URL(rawUrl);
    if (u.pathname.endsWith('/sdkjs/common/AllFonts.js')) {
      const patched = patchAllFontsSource(bodyBuffer.toString('utf8'));
      return {
        body: Buffer.from(patched, 'utf8'),
        contentType: 'text/javascript; charset=utf-8',
      };
    }
    if (/^\/rhwp\/assets\/index-[^/]+\.js$/.test(u.pathname)) {
      const patched = patchRhwpOriginCheck(bodyBuffer.toString('utf8'));
      return {
        body: Buffer.from(patched, 'utf8'),
        contentType: 'text/javascript; charset=utf-8',
      };
    }
    if (/\/sdkjs\/common\/Images\/fonts_thumbnail[^/]*\.png\.bin$/.test(u.pathname)) {
      return {
        body: padFontThumbnailSpriteBin(bodyBuffer, 280),
        contentType: contentType || 'application/octet-stream',
      };
    }
    if (u.pathname.endsWith('.wasm.br')) {
      const isWasmMagic =
        bodyBuffer.length >= 4 &&
        bodyBuffer[0] === 0x00 &&
        bodyBuffer[1] === 0x61 &&
        bodyBuffer[2] === 0x73 &&
        bodyBuffer[3] === 0x6d;
      const body = isWasmMagic ? bodyBuffer : zlib.brotliDecompressSync(bodyBuffer);
      return {
        body,
        contentType: 'application/wasm',
      };
    }
  } catch {
    // Fall through with original bytes
  }
  return { body: bodyBuffer, contentType };
}

/**
 * Creates a persistent disk cache + bundled asset responder for remote editor origins
 * (`editor.sejong.dev`, `sejongy00.github.io`, `cdn.jsdelivr.net`).
 */
function createOfflineAssetManager({ distRoot, cacheDir, netFetch }) {
  fs.mkdirSync(cacheDir, { recursive: true });

  async function readCached(rawUrl) {
    const { bodyPath, metaPath } = cacheKeyForUrl(rawUrl);
    const fullBody = path.join(cacheDir, bodyPath);
    const fullMeta = path.join(cacheDir, metaPath);
    try {
      const [body, metaRaw] = await Promise.all([
        fsp.readFile(fullBody),
        fsp.readFile(fullMeta, 'utf8'),
      ]);
      const meta = JSON.parse(metaRaw);
      return { body, contentType: meta.contentType || mimeTypeForPath(new URL(rawUrl).pathname) };
    } catch {
      return null;
    }
  }

  async function writeCached(rawUrl, bodyBuffer, contentType) {
    const { canonical, bodyPath, metaPath } = cacheKeyForUrl(rawUrl);
    const fullBody = path.join(cacheDir, bodyPath);
    const fullMeta = path.join(cacheDir, metaPath);
    try {
      await Promise.all([
        fsp.writeFile(fullBody, bodyBuffer),
        fsp.writeFile(
          fullMeta,
          JSON.stringify({ url: canonical, contentType, cachedAt: Date.now() }),
          'utf8',
        ),
      ]);
    } catch {
      // Ignore cache write errors
    }
  }

  async function handleEditorRequest(request) {
    const rawUrl = request.url;

    // 1. Pre-bundled offline Office & RHWP assets inside the app bundle (100% offline-first)
    const bundled = resolveBundledOfficeAsset(distRoot, rawUrl);
    if (bundled) {
      const rawBytes = await fsp.readFile(bundled);
      const { body, contentType } = transformOfficePayload(
        rawUrl,
        rawBytes,
        mimeTypeForPath(bundled),
      );
      return new Response(body, {
        status: 200,
        headers: {
          'content-type': contentType,
          'access-control-allow-origin': '*',
        },
      });
    }

    const isImmutableVendorAsset =
      /\/(?:sdkjs|web-apps|fonts|assets)\//.test(new URL(rawUrl).pathname);

    // 2. For immutable vendor assets (WASM, SDK, fonts, hashed bundles), serve from disk cache first
    if (isImmutableVendorAsset) {
      const hit = await readCached(rawUrl);
      if (hit) {
        const { body, contentType } = transformOfficePayload(rawUrl, hit.body, hit.contentType);
        return new Response(body, {
          status: 200,
          headers: {
            'content-type': contentType,
            'access-control-allow-origin': '*',
          },
        });
      }
    }

    // 3. Network fetch with persistent disk cache write, falling back to disk cache when offline
    try {
      const res = await netFetch(request);
      if (res.ok && request.method === 'GET') {
        const rawBytes = Buffer.from(await res.arrayBuffer());
        const rawType =
          res.headers.get('content-type') || mimeTypeForPath(new URL(rawUrl).pathname);
        const { body, contentType } = transformOfficePayload(rawUrl, rawBytes, rawType);
        await writeCached(rawUrl, body, contentType);
        const headers = new Headers(res.headers);
        headers.set('content-type', contentType);
        headers.delete('content-length');
        headers.delete('content-encoding');
        return new Response(body, {
          status: res.status,
          statusText: res.statusText,
          headers,
        });
      }
      return res;
    } catch (netErr) {
      const fallback = await readCached(rawUrl);
      if (fallback) {
        const { body, contentType } = transformOfficePayload(
          rawUrl,
          fallback.body,
          fallback.contentType,
        );
        return new Response(body, {
          status: 200,
          headers: {
            'content-type': contentType,
            'access-control-allow-origin': '*',
          },
        });
      }
      throw netErr;
    }
  }

  /**
   * Warm the persistent disk cache in the background for any unbundled asset.
   */
  async function warmOfflineEditorsInBackground() {
    const urls = [
      ...OFFICE_CORE_PATHS.map((p) => `https://editor.sejong.dev${p}`),
      'https://sejongy00.github.io/rhwp/',
    ];

    for (const targetUrl of urls) {
      try {
        if (resolveBundledOfficeAsset(distRoot, targetUrl)) continue;
        if (await readCached(targetUrl)) continue;
        const res = await netFetch(new Request(targetUrl, { method: 'GET' }));
        if (!res.ok) continue;
        const rawBytes = Buffer.from(await res.arrayBuffer());
        const rawType =
          res.headers.get('content-type') || mimeTypeForPath(new URL(targetUrl).pathname);
        const { body, contentType } = transformOfficePayload(targetUrl, rawBytes, rawType);
        await writeCached(targetUrl, body, contentType);
      } catch {
        // Offline or network busy: skip silently
        break;
      }
    }
  }

  return {
    handleEditorRequest,
    readCached,
    warmOfflineEditorsInBackground,
    writeCached,
  };
}

module.exports = {
  OFFICE_CORE_PATHS,
  cacheKeyForUrl,
  createOfflineAssetManager,
  patchRhwpOriginCheck,
  resolveBundledOfficeAsset,
  transformOfficePayload,
};
