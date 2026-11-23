import { execFileSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const require = createRequire(import.meta.url);
const {
  KOREAN_CATALOG_SLOTS,
  padFontThumbnailSpriteBin,
  patchAllFontsSource,
} = require('../src/koreanFontsPatch.cjs');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.resolve(__dirname, '..');
const frontendDist = path.resolve(desktopRoot, '../frontend/dist');
const desktopDist = path.resolve(desktopRoot, 'dist');
const bundleCacheRoot = path.resolve(desktopRoot, '.cache/offline-bundle');
const siblingDocumentPublic = path.resolve(desktopRoot, '../../../document/public');
const cachedDocumentRepo = path.resolve(desktopRoot, '.cache/document-repo');

const remoteEditorOrigin = process.env.VITE_OFFICE_EDITOR_URL || 'https://editor.sejong.dev/';
const remoteRhwpOrigin = process.env.VITE_RHWP_STUDIO_URL || 'https://sejongy00.github.io/rhwp/';

const XOR_KEY = [160, 102, 214, 32, 20, 150, 71, 250, 149, 105, 184, 80, 176, 65, 73, 72];

/**
 * Essential OnlyOffice catalog font slots:
 * - 050..070, 102, 104..129, 233, 271..272: Latin/Symbol core (Liberation, Carlito, Caladea, DejaVu, OpenSymbol, Symbola, Noto Sans)
 * - 181..187: Korean (NanumBarunGothic R/B, NanumGothic R/B, NanumMyeongjo, NanumSquare B/R)
 */
const ESSENTIAL_OFFICE_FONT_SLOTS = (() => {
  const slots = new Set();
  const addRange = (start, end) => {
    for (let i = start; i <= end; i += 1) {
      slots.add(String(i).padStart(3, '0'));
    }
  };
  addRange(50, 70);
  slots.add('102');
  addRange(104, 129);
  for (const s of KOREAN_CATALOG_SLOTS) slots.add(s);
  slots.add('233');
  addRange(271, 272);
  return [...slots];
})();

const TTF_EXPORT_NAMES = {
  '181': 'NanumBarunGothic-Regular.ttf',
  '182': 'NanumBarunGothic-Bold.ttf',
  '183': 'NanumGothic-Regular.ttf',
  '184': 'NanumGothic-Bold.ttf',
  '185': 'NanumMyeongjo-Regular.ttf',
  '186': 'NanumSquare-Bold.ttf',
  '187': 'NanumSquare-Regular.ttf',
};

function decodeCatalogFontToTtf(buf) {
  const out = Buffer.from(buf);
  for (let i = 0; i < Math.min(32, out.length); i += 1) {
    out[i] ^= XOR_KEY[i % XOR_KEY.length];
  }
  return out;
}

/**
 * Locate `document/public` from sibling repo or shallow-clone it into `.cache/document-repo`.
 */
function resolveDocumentPublicDir() {
  if (existsSync(path.join(siblingDocumentPublic, 'sdkjs/common/AllFonts.js'))) {
    return siblingDocumentPublic;
  }
  const cachedPublic = path.join(cachedDocumentRepo, 'public');
  if (existsSync(path.join(cachedPublic, 'sdkjs/common/AllFonts.js'))) {
    return cachedPublic;
  }
  console.log('[offline-bundle] Cloning sejongY00/document public vendor assets...');
  rmSync(cachedDocumentRepo, { recursive: true, force: true });
  mkdirSync(path.dirname(cachedDocumentRepo), { recursive: true });
  execFileSync(
    'git',
    ['clone', '--depth', '1', 'https://github.com/sejongY00/document.git', cachedDocumentRepo],
    { stdio: 'inherit' },
  );
  return cachedPublic;
}

async function fetchWithCache(url, cacheFile, bypassCache = false) {
  if (!bypassCache && cacheFile && existsSync(cacheFile) && statSync(cacheFile).size > 0) {
    return readFileSync(cacheFile);
  }
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: HTTP ${res.status}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (cacheFile) {
    mkdirSync(path.dirname(cacheFile), { recursive: true });
    writeFileSync(cacheFile, buf);
  }
  return buf;
}

async function fetchBatch(items, concurrency, worker) {
  let index = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (index < items.length) {
      const current = items[index];
      index += 1;
      await worker(current);
    }
  });
  await Promise.all(runners);
}

/**
 * Remove heavy web-only viewer/scanner/diagram assets from desktop `dist/` since desktop mode
 * exclusively supports Office and RHWP.
 */
function stripDesktopUnusedFrontendAssets() {
  const unusedPaths = [
    'viewer-assets',
    'excalidraw-assets',
    'assets/dxf-parser-worker.js',
    'assets/libredwg-parser-worker.js',
    'assets/mtext-renderer-worker.js',
  ];
  for (const rel of unusedPaths) {
    rmSync(path.join(desktopDist, rel), { recursive: true, force: true });
  }
}

/**
 * Bundle the complete OnlyOffice runtime (`editor.sejong.dev`) into `dist/offline-office/`.
 */
async function bundleOfflineOffice() {
  const docPublic = resolveDocumentPublicDir();
  const offlineOfficeDir = path.join(desktopDist, 'offline-office');
  const officeCacheDir = path.join(bundleCacheRoot, 'office');
  const webFontsDir = path.join(desktopDist, 'fonts');

  mkdirSync(offlineOfficeDir, { recursive: true });
  mkdirSync(officeCacheDir, { recursive: true });
  mkdirSync(webFontsDir, { recursive: true });

  // 1. Copy vendor directories from document/public (skip sdkjs/visio, visioeditor, and mobile web-apps)
  const fullDirs = ['web-apps', 'libs', 'ran-fonts', 'icons'];
  for (const dirName of fullDirs) {
    const src = path.join(docPublic, dirName);
    if (existsSync(src)) {
      cpSync(src, path.join(offlineOfficeDir, dirName), { recursive: true });
    }
  }
  rmSync(path.join(offlineOfficeDir, 'web-apps/apps/visioeditor'), { recursive: true, force: true });
  rmSync(path.join(offlineOfficeDir, 'web-apps/apps/common/embed'), { recursive: true, force: true });
  for (const appName of ['documenteditor', 'presentationeditor', 'spreadsheeteditor', 'pdfeditor']) {
    const appDir = path.join(offlineOfficeDir, 'web-apps/apps', appName);
    rmSync(path.join(appDir, 'mobile'), { recursive: true, force: true });
    rmSync(path.join(appDir, 'embed'), { recursive: true, force: true });
    rmSync(path.join(appDir, 'main/ie'), { recursive: true, force: true });
    const localeDir = path.join(appDir, 'main/locale');
    if (existsSync(localeDir)) {
      for (const file of readdirSync(localeDir)) {
        if (file.endsWith('.json') && !/^(?:ko|en)(?:[-_].+)?\.json$/i.test(file)) {
          rmSync(path.join(localeDir, file), { force: true });
        }
      }
    }
  }

  const sdkDirs = ['common', 'word', 'cell', 'slide', 'pdf'];
  for (const sdkSub of sdkDirs) {
    const src = path.join(docPublic, 'sdkjs', sdkSub);
    if (existsSync(src)) {
      cpSync(src, path.join(offlineOfficeDir, 'sdkjs', sdkSub), { recursive: true });
    }
  }

  const rootFiles = [
    'app-tokens.css',
    'ran-tokens.css',
    'theme-presentation.js',
    'themes.json',
    'plugins.json',
    'manifest.json',
  ];
  for (const fileName of rootFiles) {
    const src = path.join(docPublic, fileName);
    if (existsSync(src)) {
      cpSync(src, path.join(offlineOfficeDir, fileName));
    }
  }

  // 2. Decompress x2t.wasm.br in-place so Electron's custom protocol can serve raw WASM bytes
  const x2tBrPath = path.join(offlineOfficeDir, 'sdkjs/common/wasm/x2t/x2t.wasm.br');
  if (existsSync(x2tBrPath)) {
    const raw = readFileSync(x2tBrPath);
    const isWasmMagic =
      raw.length >= 4 &&
      raw[0] === 0x00 &&
      raw[1] === 0x61 &&
      raw[2] === 0x73 &&
      raw[3] === 0x6d;
    if (!isWasmMagic) {
      const decompressed = zlib.brotliDecompressSync(raw);
      writeFileSync(x2tBrPath, decompressed);
    }
  }

  // 3. Patch AllFonts.js and pad font thumbnail sprites
  const allFontsPath = path.join(offlineOfficeDir, 'sdkjs/common/AllFonts.js');
  if (existsSync(allFontsPath)) {
    const patched = patchAllFontsSource(readFileSync(allFontsPath, 'utf8'));
    writeFileSync(allFontsPath, patched, 'utf8');
  }

  const imagesDir = path.join(offlineOfficeDir, 'sdkjs/common/Images');
  if (existsSync(imagesDir)) {
    for (const name of readdirSync(imagesDir)) {
      if (/^fonts_thumbnail[^/]*\.png\.bin$/.test(name)) {
        const binPath = path.join(imagesDir, name);
        const padded = padFontThumbnailSpriteBin(readFileSync(binPath), 260);
        writeFileSync(binPath, padded);
      }
    }
  }

  // 4. Copy essential font slots and export decoded Korean TTFs
  const offlineFontsDir = path.join(offlineOfficeDir, 'fonts');
  mkdirSync(offlineFontsDir, { recursive: true });
  for (const slot of ESSENTIAL_OFFICE_FONT_SLOTS) {
    const srcSlot = path.join(docPublic, 'fonts', slot);
    if (!existsSync(srcSlot)) continue;
    const catalogBytes = readFileSync(srcSlot);
    writeFileSync(path.join(offlineFontsDir, slot), catalogBytes);
    const ttfName = TTF_EXPORT_NAMES[slot];
    if (ttfName) {
      const decodedTtf = decodeCatalogFontToTtf(catalogBytes);
      writeFileSync(path.join(webFontsDir, ttfName), decodedTtf);
    }
  }

  // 5. Fetch built OnlyOffice host shell (editor.html + hashed assets from sw.js)
  const swUrl = new URL('sw.js', remoteEditorOrigin).toString();
  const swText = (await fetchWithCache(swUrl, path.join(officeCacheDir, 'sw.js'), true)).toString('utf8');

  const appAssetsMatch = swText.match(/const APP_ASSETS_TO_CACHE\s*=\s*(\[[\s\S]*?\]);/);
  const coreAssetsMatch = swText.match(/const ASSETS_TO_CACHE\s*=\s*(\[[\s\S]*?\]);/);
  const appAssets = appAssetsMatch ? JSON.parse(appAssetsMatch[1]) : [];
  const coreAssets = coreAssetsMatch
    ? [
        ...coreAssetsMatch[1]
          .replace(/\/\/[^\n]*/g, '')
          .matchAll(/['"]([^'"]+)['"]/g),
      ].map((m) => m[1])
    : [];

  const shellRelativePaths = new Set([
    'editor.html',
    'index.html',
    ...appAssets.map((p) => p.replace(/^\.?\//, '')),
    ...coreAssets.map((p) => p.replace(/^\.?\//, '')).filter((p) => p && p !== 'editor'),
  ]);

  await fetchBatch([...shellRelativePaths], 8, async (relPath) => {
    const targetPath = path.join(offlineOfficeDir, relPath);
    if (existsSync(targetPath) && statSync(targetPath).size > 0 && !relPath.endsWith('.html')) {
      return;
    }
    const cachePath = path.join(officeCacheDir, relPath);
    const url = new URL(relPath, remoteEditorOrigin).toString();
    const isHtml = relPath.endsWith('.html');
    const bytes = await fetchWithCache(url, cachePath, isHtml);
    mkdirSync(path.dirname(targetPath), { recursive: true });
    writeFileSync(targetPath, bytes);
  });

  // Also write editor.html to offline-office/editor/index.html so `/editor` resolves directly
  // Inject synchronous api.js preload and disable redundant Service Worker wait (15s timeout in waitForAppWorkerControl)
  const disableSwBanner = 'try { delete Navigator.prototype.serviceWorker; } catch (e) {}\n';
  const themePresPath = path.join(offlineOfficeDir, 'theme-presentation.js');
  if (existsSync(themePresPath)) {
    const rawTheme = readFileSync(themePresPath, 'utf8');
    if (!rawTheme.includes('delete Navigator.prototype.serviceWorker')) {
      writeFileSync(themePresPath, disableSwBanner + rawTheme, 'utf8');
    }
  }

  writeFileSync(
    path.join(offlineOfficeDir, 'sw.js'),
    'self.addEventListener("install",()=>self.skipWaiting());self.addEventListener("activate",(e)=>e.waitUntil(self.clients.claim()));\n',
    'utf8',
  );

  const editorHtmlPath = path.join(offlineOfficeDir, 'editor.html');
  if (existsSync(editorHtmlPath)) {
    let editorHtml = readFileSync(editorHtmlPath, 'utf8');
    const apiScriptTag = '<script src="./web-apps/apps/api/documents/api.js"></script>';
    if (!editorHtml.includes(apiScriptTag)) {
      editorHtml = editorHtml.replace(
        '<script src="./theme-presentation.js"></script>',
        `<script src="./theme-presentation.js"></script>\n    ${apiScriptTag}`,
      );
      writeFileSync(editorHtmlPath, editorHtml, 'utf8');
    }
    const editorDirIndex = path.join(offlineOfficeDir, 'editor/index.html');
    mkdirSync(path.dirname(editorDirIndex), { recursive: true });
    cpSync(editorHtmlPath, editorDirIndex);
  }
}

/**
 * Bundle the complete RHWP Studio runtime (`sejongy00.github.io/rhwp/`) into `dist/offline-rhwp/`.
 */
async function bundleOfflineRhwp() {
  const offlineRhwpDir = path.join(desktopDist, 'offline-rhwp');
  const rhwpCacheDir = path.join(bundleCacheRoot, 'rhwp');
  const webFontsDir = path.join(desktopDist, 'fonts');

  mkdirSync(offlineRhwpDir, { recursive: true });
  mkdirSync(rhwpCacheDir, { recursive: true });

  const swUrl = new URL('sw.js', remoteRhwpOrigin).toString();
  const swText = (await fetchWithCache(swUrl, path.join(rhwpCacheDir, 'sw.js'), true)).toString('utf8');

  const precacheUrls = [
    ...new Set([...swText.matchAll(/url:\s*"([^"]+)"/g)].map((m) => m[1].replace(/^\/+/, ''))),
  ];

  await fetchBatch(precacheUrls, 8, async (relPath) => {
    const cachePath = path.join(rhwpCacheDir, relPath);
    const targetPath = path.join(offlineRhwpDir, relPath);
    const url = new URL(relPath, remoteRhwpOrigin).toString();
    const isHtml = relPath.endsWith('.html');
    const bytes = await fetchWithCache(url, cachePath, isHtml);
    mkdirSync(path.dirname(targetPath), { recursive: true });
    writeFileSync(targetPath, bytes);
  });

  // Scan downloaded JS bundles for WASM binaries (assets/rhwp_bg-*.wasm, assets/canvaskit-*.wasm)
  const wasmRelPaths = new Set();
  for (const relPath of precacheUrls) {
    if (!relPath.endsWith('.js')) continue;
    const jsPath = path.join(offlineRhwpDir, relPath);
    if (!existsSync(jsPath)) continue;
    const jsText = readFileSync(jsPath, 'utf8');
    for (const m of jsText.matchAll(/[A-Za-z0-9_./-]+\.wasm/g)) {
      const token = m[0];
      if (token.includes('this.') || token.startsWith('e.') || token.startsWith('t.')) continue;
      const normalized = token.replace(/^\/?rhwp\//, '').replace(/^\.?\//, '');
      if (
        normalized &&
        normalized.endsWith('.wasm') &&
        normalized !== 'canvaskit.wasm' &&
        normalized !== 'rhwp_bg.wasm'
      ) {
        wasmRelPaths.add(normalized);
      }
    }
  }

  await fetchBatch([...wasmRelPaths], 4, async (relPath) => {
    const cachePath = path.join(rhwpCacheDir, relPath);
    const targetPath = path.join(offlineRhwpDir, relPath);
    const url = new URL(relPath, remoteRhwpOrigin).toString();
    const bytes = await fetchWithCache(url, cachePath, false);
    mkdirSync(path.dirname(targetPath), { recursive: true });
    writeFileSync(targetPath, bytes);
  });

  const rhwpThemeInitPath = path.join(offlineRhwpDir, 'theme-init.js');
  if (existsSync(rhwpThemeInitPath)) {
    const rawInit = readFileSync(rhwpThemeInitPath, 'utf8');
    if (!rawInit.includes('delete Navigator.prototype.serviceWorker')) {
      writeFileSync(
        rhwpThemeInitPath,
        'try { delete Navigator.prototype.serviceWorker; } catch (e) {}\n' + rawInit,
        'utf8',
      );
    }
  }
}

async function main() {
  if (!existsSync(frontendDist)) {
    throw new Error(`프론트엔드 빌드 결과물이 없습니다: ${frontendDist}`);
  }

  rmSync(desktopDist, { recursive: true, force: true });
  mkdirSync(desktopDist, { recursive: true });
  cpSync(frontendDist, desktopDist, { recursive: true });

  stripDesktopUnusedFrontendAssets();
  await bundleOfflineOffice();
  await bundleOfflineRhwp();

  console.log(
    'Prepared 100% offline-ready desktop bundle (Office + RHWP + Korean fonts) in packages/desktop/dist',
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
