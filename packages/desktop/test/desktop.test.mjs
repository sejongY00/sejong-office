import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  buildIcnsFromPngs,
  buildIcoFromPngs,
  generateDesktopIcons,
  readPngDimensions,
} from '../scripts/generate-desktop-icons.mjs';

const require = createRequire(import.meta.url);
const {
  extractFilePathsFromArgv,
  mimeTypeForPath,
  resolveDistAsset,
} = require('../src/fileArgs.cjs');
const {
  buildIframeWindowControlsScript,
} = require('../src/windowControlsInjector.cjs');
const {
  decodeSelectionBin,
  encodeSelectionBin,
  padFontThumbnailSpriteBin,
  patchAllFontsSource,
} = require('../src/koreanFontsPatch.cjs');
const {
  createOfflineAssetManager,
  patchRhwpOriginCheck,
  resolveBundledOfficeAsset,
} = require('../src/offlineCache.cjs');
const {
  compareSemver,
  createDesktopUpdater,
  selectReleaseAsset,
} = require('../src/autoUpdater.cjs');
const { enrichMacInfoPlist } = require('../scripts/after-pack.cjs');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.resolve(__dirname, '..');
const frontendPublic = path.resolve(desktopRoot, '../frontend/public');

test('generateDesktopIcons builds valid multi-resolution .ico and .icns files for app and all 6 file types', async () => {
  const tmpOut = mkdtempSync(path.join(os.tmpdir(), 'sejong-icons-'));
  try {
    await generateDesktopIcons(path.join(frontendPublic, 'icons'), tmpOut);

    const expectedBaseNames = [
      'icon',
      'file-word',
      'file-excel',
      'file-csv',
      'file-powerpoint',
      'file-pdf',
      'file-hwp',
    ];

    for (const name of expectedBaseNames) {
      const icoPath = path.join(tmpOut, `${name}.ico`);
      const icnsPath = path.join(tmpOut, `${name}.icns`);
      assert.equal(existsSync(icoPath), true, `Missing ${name}.ico`);
      assert.equal(existsSync(icnsPath), true, `Missing ${name}.icns`);

      const icoBytes = readFileSync(icoPath);
      assert.equal(icoBytes.readUInt16LE(0), 0);
      assert.equal(icoBytes.readUInt16LE(2), 1);
      assert.ok(icoBytes.readUInt16LE(4) >= 7, `${name}.ico should contain multiple sizes`);

      const icnsBytes = readFileSync(icnsPath);
      assert.equal(icnsBytes.subarray(0, 4).toString('ascii'), 'icns');
      assert.equal(icnsBytes.readUInt32BE(4), icnsBytes.byteLength);
      const chunkTypes = [];
      let off = 8;
      while (off + 8 <= icnsBytes.byteLength) {
        chunkTypes.push(icnsBytes.subarray(off, off + 4).toString('ascii'));
        off += icnsBytes.readUInt32BE(off + 4);
      }
      assert.equal(chunkTypes.includes('icp4'), false, `${name}.icns must not contain raw-PNG icp4`);
      assert.equal(chunkTypes.includes('icp5'), false, `${name}.icns must not contain raw-PNG icp5`);
      assert.ok(chunkTypes.includes('ic11'), `${name}.icns missing 32px ic11`);
      assert.ok(chunkTypes.includes('ic12'), `${name}.icns missing 64px ic12`);
      assert.ok(chunkTypes.includes('ic08'), `${name}.icns missing 256px ic08`);
      assert.ok(chunkTypes.includes('ic09'), `${name}.icns missing 512px ic09`);
      if (process.platform === 'darwin') {
        assert.ok(chunkTypes.includes('ic04'), `${name}.icns missing native 16px ic04`);
        assert.ok(chunkTypes.includes('ic05'), `${name}.icns missing native 32px ic05`);
      }
    }
  } finally {
    rmSync(tmpOut, { recursive: true, force: true });
  }
});

test('enrichMacInfoPlist adds LSItemContentTypes and HWP UTIs for Finder icons', () => {
  const enriched = enrichMacInfoPlist({
    CFBundleDocumentTypes: [
      { CFBundleTypeExtensions: ['csv'], CFBundleTypeIconFile: 'file-csv.icns' },
      { CFBundleTypeExtensions: ['docx'], CFBundleTypeIconFile: 'file-word.icns' },
      { CFBundleTypeExtensions: ['hwp', 'hwpx'], CFBundleTypeIconFile: 'file-hwp.icns' },
    ],
  });
  const csvDoc = enriched.CFBundleDocumentTypes[0];
  assert.deepEqual(csvDoc.LSItemContentTypes, ['public.comma-separated-values-text']);
  assert.equal(csvDoc.CFBundleTypeIconSystemGenerated, 0);
  assert.ok(
    enriched.CFBundleDocumentTypes[1].LSItemContentTypes.includes(
      'org.openxmlformats.wordprocessingml.document',
    ),
  );
  assert.ok(
    enriched.UTImportedTypeDeclarations.some((u) => u.UTTypeIdentifier === 'com.hancom.hwp'),
  );
});

test('desktop package.json fileAssociations match manifest.webmanifest file_handlers', () => {
  const pkg = JSON.parse(readFileSync(path.join(desktopRoot, 'package.json'), 'utf8'));
  const manifest = JSON.parse(
    readFileSync(path.join(frontendPublic, 'manifest.webmanifest'), 'utf8'),
  );

  const manifestExts = new Set();
  for (const handler of manifest.file_handlers ?? []) {
    for (const exts of Object.values(handler.accept)) {
      for (const ext of exts) {
        manifestExts.add(ext.replace(/^\./, '').toLowerCase());
      }
    }
  }

  const desktopExts = new Set();
  for (const assoc of pkg.build?.fileAssociations ?? []) {
    const list = Array.isArray(assoc.ext) ? assoc.ext : [assoc.ext];
    for (const ext of list) {
      desktopExts.add(String(ext).toLowerCase());
    }
    assert.match(assoc.icon, /^file-[a-z]+$/);
    const pngPath = path.join(frontendPublic, 'icons', `${assoc.icon}.png`);
    assert.equal(existsSync(pngPath), true, `Missing source PNG for ${assoc.icon}`);
    const dims = readPngDimensions(readFileSync(pngPath));
    assert.equal(dims.width, 256);
    assert.equal(dims.height, 256);
  }

  assert.deepEqual([...desktopExts].sort(), [...manifestExts].sort());
});

test('extractFilePathsFromArgv picks real document paths and skips flags or scripts', () => {
  const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'sejong-argv-'));
  try {
    const docPath = path.join(tmpDir, 'sample.docx');
    const hwpPath = path.join(tmpDir, '한글문서.hwpx');
    const scriptPath = path.join(tmpDir, 'main.cjs');
    writeFileSync(docPath, 'docx');
    writeFileSync(hwpPath, 'hwpx');
    writeFileSync(scriptPath, '// main');

    const extracted = extractFilePathsFromArgv(
      [
        '/Applications/Sejong Office.app/Contents/MacOS/Sejong Office',
        scriptPath,
        '--inspect=9229',
        '-psn_0_12345',
        docPath,
        hwpPath,
        docPath,
        path.join(tmpDir, 'nonexistent.xlsx'),
      ],
      tmpDir,
      scriptPath,
    );

    assert.deepEqual(extracted, [docPath, hwpPath]);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('resolveDistAsset serves static files, SPA fallback routes, and blocks path traversal', () => {
  const tmpDist = mkdtempSync(path.join(os.tmpdir(), 'sejong-dist-'));
  try {
    const indexHtml = path.join(tmpDist, 'index.html');
    const iconSvg = path.join(tmpDist, 'icon.svg');
    writeFileSync(indexHtml, '<!doctype html>');
    writeFileSync(iconSvg, '<svg></svg>');

    assert.equal(resolveDistAsset(tmpDist, 'app://bundle/icon.svg'), iconSvg);
    assert.equal(resolveDistAsset(tmpDist, 'app://bundle/office?d=1'), indexHtml);
    assert.equal(resolveDistAsset(tmpDist, 'app://bundle/missing.png'), null);
    assert.equal(mimeTypeForPath(iconSvg), 'image/svg+xml');
    assert.equal(mimeTypeForPath('model.wasm'), 'application/wasm');
  } finally {
    rmSync(tmpDist, { recursive: true, force: true });
  }
});

test('buildIframeWindowControlsScript injects [홈 최소화 최대화 닫기] icons and drag handlers for OnlyOffice and RHWP headers', () => {
  const script = buildIframeWindowControlsScript();
  for (const label of ['홈', '최소화', '최대화', '닫기']) {
    assert.ok(script.includes(`label: '${label}'`), `Missing button label ${label}`);
  }
  for (const action of ['home', 'minimize', 'toggle-maximize', 'close-app', 'drag-start', 'drag-end']) {
    assert.ok(script.includes(`'${action}'`), `Missing action ${action}`);
  }
  assert.ok(script.includes('<svg'));
  assert.ok(script.includes('#rhwp-embed-close-btn'));
  assert.ok(script.includes('#slot-btn-close'));
  assert.ok(script.includes('#title-doc-name:disabled'));
  assert.ok(script.includes('#toolbox-basic-toggle'));
  assert.ok(script.includes('insertBefore(toggleBtn, bar)'));
});

test('patchRhwpOriginCheck allows app:// parent origin in RHWP Studio bridge and is idempotent', () => {
  const sample = 'function dw(e){if(!e||e===`null`)return!1;try{let t=new URL(e).protocol;return t===`http:`||t===`https:`}catch{return!1}}';
  const once = patchRhwpOriginCheck(sample);
  assert.ok(once.includes('t===`http:`||t===`https:`||t===`app:`'));
  assert.equal(patchRhwpOriginCheck(once), once);
});

test('patchAllFontsSource registers 나눔고딕, 나눔바른고딕, 나눔스퀘어 and automatic Korean aliases', () => {
  const sampleRecords = [
    {
      name: 'NanumGothic',
      altNames: ['나눔고딕'],
      path: '/fonts/NanumGothic.ttf',
      index: 0,
      italic: 0,
      bold: 0,
      fixed: 0,
      panose: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      unicodeRange: [0, 0, 0, 0],
      codePageRange: [524288, 0],
      weight: 400,
      width: 5,
      familyClass: 0,
      format: 1,
      avgCharWidth: 500,
      ascent: 800,
      descent: 200,
      lineGap: 0,
      xHeight: 500,
      capHeight: 700,
      type: 0,
      trailing: Buffer.alloc(0),
    },
    {
      name: 'NanumBarunGothic',
      altNames: ['나눔바른고딕'],
      path: '/fonts/NanumBarunGothic.ttf',
      index: 0,
      italic: 0,
      bold: 0,
      fixed: 0,
      panose: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      unicodeRange: [0, 0, 0, 0],
      codePageRange: [524288, 0],
      weight: 400,
      width: 5,
      familyClass: 0,
      format: 1,
      avgCharWidth: 500,
      ascent: 800,
      descent: 200,
      lineGap: 0,
      xHeight: 500,
      capHeight: 700,
      type: 0,
      trailing: Buffer.alloc(0),
    },
    {
      name: 'NanumSquare',
      altNames: ['나눔스퀘어'],
      path: '/fonts/NanumSquareR.ttf',
      index: 0,
      italic: 0,
      bold: 0,
      fixed: 0,
      panose: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      unicodeRange: [0, 0, 0, 0],
      codePageRange: [524288, 0],
      weight: 400,
      width: 5,
      familyClass: 0,
      format: 1,
      avgCharWidth: 500,
      ascent: 800,
      descent: 200,
      lineGap: 0,
      xHeight: 500,
      capHeight: 700,
      type: 0,
      trailing: Buffer.alloc(0),
    },
    {
      name: 'NanumSquare Bold',
      altNames: [],
      path: '/fonts/NanumSquareB.ttf',
      index: 0,
      italic: 0,
      bold: 0,
      fixed: 0,
      panose: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      unicodeRange: [0, 0, 0, 0],
      codePageRange: [524288, 0],
      weight: 700,
      width: 5,
      familyClass: 0,
      format: 1,
      avgCharWidth: 500,
      ascent: 800,
      descent: 200,
      lineGap: 0,
      xHeight: 500,
      capHeight: 700,
      type: 0,
      trailing: Buffer.alloc(0),
    },
    {
      name: 'Carlito',
      altNames: [],
      path: '/fonts/Carlito-Bold.ttf',
      index: 0,
      italic: 0,
      bold: 1,
      fixed: 0,
      panose: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      unicodeRange: [0, 0, 0, 0],
      codePageRange: [1, 0],
      weight: 700,
      width: 5,
      familyClass: 0,
      format: 1,
      avgCharWidth: 500,
      ascent: 800,
      descent: 200,
      lineGap: 0,
      xHeight: 500,
      capHeight: 700,
      type: 0,
      trailing: Buffer.alloc(0),
    },
    {
      name: 'NanumMyeongjo',
      altNames: ['나눔명조'],
      path: '/fonts/NanumMyeongjo.ttf',
      index: 0,
      italic: 0,
      bold: 0,
      fixed: 0,
      panose: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      unicodeRange: [0, 0, 0, 0],
      codePageRange: [524288, 0],
      weight: 400,
      width: 5,
      familyClass: 0,
      format: 1,
      avgCharWidth: 500,
      ascent: 800,
      descent: 200,
      lineGap: 0,
      xHeight: 500,
      capHeight: 700,
      type: 0,
      trailing: Buffer.alloc(0),
    },
  ];

  const base64 = encodeSelectionBin({ records: sampleRecords });
  const fakeAllFonts = [
    'window["__fonts_files"] = ["181","182","183","184","185","186","187"];',
    'window["__fonts_infos"] = [',
    '["Calibri",115,0,-1,-1,-1,-1,-1,-1],',
    '["NanumBarunGothic",181,0,-1,-1,182,0,-1,-1],',
    '["NanumGothic",183,0,-1,-1,184,0,-1,-1],',
    '["NanumMyeongjo",185,0,-1,-1,-1,-1,-1,-1],',
    '["NanumSquare",187,0,-1,-1,-1,-1,-1,-1],',
    '["Noto Sans KR",231,0,-1,-1,228,0,-1,-1]',
    '];',
    `window["g_fonts_selection_bin"] = "${base64}";`,
  ].join('\n');

  const patched = patchAllFontsSource(fakeAllFonts);
  assert.ok(patched.includes('__SEJONG_KR_FONTS_PATCHED__'));
  assert.ok(patched.includes('["Calibri",115,0,114,0,112,0,113,0]'));
  assert.ok(patched.includes('["Noto Sans KR",183,0,-1,-1,184,0,-1,-1]'));
  assert.ok(patched.includes('["NanumSquare",187,0,-1,-1,186,0,-1,-1]'));
  assert.ok(patched.includes('["NanumMyeongjo",185,0,-1,-1,-1,-1,-1,-1]'));
  assert.ok(patched.includes('["바탕",185,0,-1,-1,-1,-1,-1,-1]'));
  for (const name of [
    '나눔고딕',
    '나눔바른고딕',
    '나눔스퀘어',
    '나눔명조',
    '맑은 고딕',
    '바탕',
    '돋움',
    '굴림',
    '궁서',
    '함초롬바탕',
    '함초롬돋움',
    'Aptos',
    'Cambria',
  ]) {
    assert.ok(patched.includes(`["${name}",`), `Missing __fonts_infos row for ${name}`);
  }

  const selMarker = 'window["g_fonts_selection_bin"] = "';
  const selStart = patched.indexOf(selMarker) + selMarker.length;
  const selEnd = patched.indexOf('"', selStart);
  const decoded = decodeSelectionBin(patched.slice(selStart, selEnd));
  const gothicRec = decoded.records.find((r) => r.name === 'NanumGothic');
  const barunRec = decoded.records.find((r) => r.name === 'NanumBarunGothic');
  const myeongjoRec = decoded.records.find((r) => r.name === 'NanumMyeongjo');
  const squareBoldRec = decoded.records.find((r) => r.name === 'NanumSquare Bold');
  const carlitoRec = decoded.records.find((r) => r.name === 'Carlito');
  assert.ok(gothicRec.altNames.includes('맑은 고딕'));
  assert.ok(barunRec.altNames.includes('함초롬돋움'));
  assert.ok(myeongjoRec.altNames.includes('함초롬바탕'));
  assert.equal(squareBoldRec.bold, 1);
  assert.ok(carlitoRec.altNames.includes('Calibri'));
  assert.ok(carlitoRec.altNames.includes('Aptos'));
});

test('padFontThumbnailSpriteBin pads sprite tile count and offline manager serves cached assets when offline', async () => {
  const header = Buffer.alloc(12);
  header.writeUInt32BE(10, 0);
  header.writeUInt32BE(4, 4);
  header.writeUInt32BE(2, 8);
  const body = Buffer.from([0, 40, 0, 40]);
  const padded = padFontThumbnailSpriteBin(Buffer.concat([header, body]), 5);
  assert.equal(padded.readUInt32BE(8), 5);

  const tmpRoot = mkdtempSync(path.join(os.tmpdir(), 'sejong-offline-'));
  try {
    const distRoot = path.join(tmpRoot, 'dist');
    const cacheDir = path.join(tmpRoot, 'cache');
    let online = true;

    const manager = createOfflineAssetManager({
      distRoot,
      cacheDir,
      netFetch: async (req) => {
        if (!online) throw new Error('ERR_INTERNET_DISCONNECTED');
        return new Response('console.log("cached-sdk");', {
          status: 200,
          headers: { 'content-type': 'text/javascript; charset=utf-8' },
        });
      },
    });

    const url = 'https://editor.sejong.dev/sdkjs/word/sdk-all-min.js';
    const first = await manager.handleEditorRequest(new Request(url));
    assert.equal(first.status, 200);
    assert.equal(await first.text(), 'console.log("cached-sdk");');

    // Disconnect network and verify offline disk cache serves the asset
    online = false;
    const second = await manager.handleEditorRequest(new Request(url));
    assert.equal(second.status, 200);
    assert.equal(await second.text(), 'console.log("cached-sdk");');

    // Pre-bundled Office, RHWP, font slot fallbacks, and CDN font mappings work 100% offline from first launch
    mkdirSync(path.join(distRoot, 'offline-office/fonts'), { recursive: true });
    mkdirSync(path.join(distRoot, 'offline-rhwp/assets'), { recursive: true });
    mkdirSync(path.join(distRoot, 'fonts'), { recursive: true });

    writeFileSync(path.join(distRoot, 'offline-office/editor.html'), '<!doctype html><title>Office</title>');
    writeFileSync(path.join(distRoot, 'offline-office/fonts/183'), 'NANUM_CATALOG_183');
    writeFileSync(path.join(distRoot, 'offline-rhwp/index.html'), '<!doctype html><title>RHWP</title>');
    writeFileSync(path.join(distRoot, 'offline-rhwp/assets/rhwp_bg.wasm'), '\0asm');
    writeFileSync(path.join(distRoot, 'fonts/NanumMyeongjo-Regular.ttf'), 'MYEONGJO_TTF');
    writeFileSync(path.join(distRoot, 'fonts/NanumBarunGothic-Regular.ttf'), 'BARUN_TTF');

    assert.ok(
      resolveBundledOfficeAsset(
        distRoot,
        'https://editor.sejong.dev/editor?embed=1&locale=ko&embedOrigin=app%3A%2F%2Fbundle',
      )?.endsWith(path.join('offline-office', 'editor.html')),
    );
    assert.ok(
      resolveBundledOfficeAsset(distRoot, 'https://editor.sejong.dev/fonts/999')?.endsWith(
        path.join('offline-office', 'fonts', '183'),
      ),
    );
    assert.ok(
      resolveBundledOfficeAsset(distRoot, 'https://sejongy00.github.io/rhwp/')?.endsWith(
        path.join('offline-rhwp', 'index.html'),
      ),
    );
    assert.ok(
      resolveBundledOfficeAsset(
        distRoot,
        'https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_2104@1.0/HANBatang.woff',
      )?.endsWith(path.join('fonts', 'NanumMyeongjo-Regular.ttf')),
    );
    assert.ok(
      resolveBundledOfficeAsset(
        distRoot,
        'https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_four@1.0/HCRDotum.woff',
      )?.endsWith(path.join('fonts', 'NanumBarunGothic-Regular.ttf')),
    );

    const rhwpRes = await manager.handleEditorRequest(
      new Request('https://sejongy00.github.io/rhwp/'),
    );
    assert.equal(rhwpRes.status, 200);
    assert.match(await rhwpRes.text(), /<title>RHWP<\/title>/);
  } finally {
    rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('autoUpdater compares semver, selects OS/arch installer assets, and handles offline and online checks', async () => {
  assert.equal(compareSemver('v0.1.1', '0.1.0'), 1);
  assert.equal(compareSemver('0.1.0', 'v0.1.0'), 0);
  assert.equal(compareSemver('0.1.0-beta.1', '0.1.0'), -1);

  const sampleAssets = [
    { name: 'Sejong-Office-0.2.0-mac-arm64.dmg', browser_download_url: 'https://example.com/arm64.dmg' },
    { name: 'Sejong-Office-0.2.0-mac-arm64.dmg.blockmap', browser_download_url: 'https://example.com/arm64.blockmap' },
    { name: 'Sejong-Office-0.2.0-mac-x64.dmg', browser_download_url: 'https://example.com/x64.dmg' },
    { name: 'Sejong-Office-0.2.0-win-x64.__uninstaller.exe', browser_download_url: 'https://example.com/uninst.exe' },
    { name: 'Sejong-Office-0.2.0-win-x64.exe', browser_download_url: 'https://example.com/win.exe' },
  ];

  assert.equal(selectReleaseAsset(sampleAssets, 'darwin', 'arm64')?.name, 'Sejong-Office-0.2.0-mac-arm64.dmg');
  assert.equal(selectReleaseAsset(sampleAssets, 'darwin', 'x64')?.name, 'Sejong-Office-0.2.0-mac-x64.dmg');
  assert.equal(selectReleaseAsset(sampleAssets, 'win32', 'x64')?.name, 'Sejong-Office-0.2.0-win-x64.exe');

  // Offline silent check stays idle; manual check surfaces error cleanly
  const offlineUpdater = createDesktopUpdater({
    app: { isPackaged: true, getVersion: () => '0.1.0', getPath: () => os.tmpdir() },
    BrowserWindow: { getAllWindows: () => [] },
    net: {
      fetch: async () => {
        throw new Error('ERR_INTERNET_DISCONNECTED');
      },
    },
    shell: { openExternal: async () => {}, openPath: async () => '' },
    platform: 'darwin',
    arch: 'arm64',
  });

  const silentRes = await offlineUpdater.checkForUpdates({ silent: true });
  assert.equal(silentRes.status, 'idle');

  const manualRes = await offlineUpdater.checkForUpdates({ silent: false });
  assert.equal(manualRes.status, 'error');

  // Online GitHub release check detects newer version and picks matching macOS arm64 dmg
  const onlineUpdater = createDesktopUpdater({
    app: { isPackaged: true, getVersion: () => '0.1.0', getPath: () => os.tmpdir() },
    BrowserWindow: { getAllWindows: () => [] },
    net: {
      fetch: async () =>
        new Response(
          JSON.stringify({
            tag_name: 'v0.2.0',
            html_url: 'https://github.com/sejongY00/sejong-office/releases/tag/v0.2.0',
            assets: sampleAssets,
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
    },
    shell: { openExternal: async () => {}, openPath: async () => '' },
    platform: 'darwin',
    arch: 'arm64',
  });

  const avail = await onlineUpdater.checkForUpdates({ silent: true });
  assert.equal(avail.status, 'available');
  assert.equal(avail.latestVersion, '0.2.0');
  assert.equal(avail.mode, 'manual-dmg');
  assert.equal(avail.downloadUrl, 'https://example.com/arm64.dmg');
});

test('manual-dmg updater defers opening installer until installUpdate and quits after unsaved confirmation', async () => {
  const downloadsDir = mkdtempSync(path.join(os.tmpdir(), 'sejong-updater-dl-'));
  try {
    let allowQuit = false;
    const events = [];
    const openedPaths = [];
    let openPathResult = '';

    const updater = createDesktopUpdater({
      app: {
        isPackaged: true,
        getVersion: () => '0.1.0',
        getPath: (key) => (key === 'downloads' ? downloadsDir : os.tmpdir()),
        quit: () => events.push('app.quit'),
      },
      BrowserWindow: { getAllWindows: () => [] },
      net: {
        fetch: async (url) => {
          if (url.includes('api.github.com')) {
            return new Response(
              JSON.stringify({
                tag_name: 'v0.2.0',
                html_url: 'https://github.com/sejongY00/sejong-office/releases/tag/v0.2.0',
                assets: [
                  { name: 'Sejong-Office-0.2.0-mac-arm64.dmg', browser_download_url: 'https://example.com/arm64.dmg' },
                ],
              }),
              { status: 200, headers: { 'content-type': 'application/json' } },
            );
          }
          return new Response(new Uint8Array([1, 2, 3, 4]), {
            status: 200,
            headers: { 'content-length': '4' },
          });
        },
      },
      shell: {
        openExternal: async () => {},
        openPath: async (target) => {
          openedPaths.push(target);
          events.push('shell.openPath');
          return openPathResult;
        },
      },
      confirmBeforeQuitForUpdate: async () => {
        events.push('confirmBeforeQuitForUpdate');
        return allowQuit;
      },
      onBeforeQuitForUpdate: () => events.push('onBeforeQuitForUpdate'),
      platform: 'darwin',
      arch: 'arm64',
    });

    await updater.checkForUpdates({ silent: false });
    const downloaded = await updater.downloadUpdate();
    const expectedPath = path.join(downloadsDir, 'Sejong-Office-0.2.0-mac-arm64.dmg');
    assert.equal(downloaded.status, 'downloaded');
    assert.equal(downloaded.downloadedPath, expectedPath);
    assert.equal(existsSync(expectedPath), true);
    // Download completion must NOT auto-open the installer
    assert.deepEqual(openedPaths, []);
    assert.deepEqual(events, []);

    // Cancelled by user -> no openPath, no onBeforeQuitForUpdate, no app.quit
    allowQuit = false;
    assert.equal(await updater.installUpdate(), false);
    assert.deepEqual(openedPaths, []);
    assert.deepEqual(events, ['confirmBeforeQuitForUpdate']);

    // shell.openPath error -> sets error state and does NOT quit
    events.length = 0;
    allowQuit = true;
    openPathResult = 'Failed to open DMG';
    assert.equal(await updater.installUpdate(), false);
    assert.equal(updater.getState().status, 'error');
    assert.deepEqual(events, ['confirmBeforeQuitForUpdate', 'shell.openPath']);

    // Confirmed & openPath succeeds -> openPath -> onBeforeQuitForUpdate -> app.quit
    events.length = 0;
    openedPaths.length = 0;
    openPathResult = '';
    assert.equal(await updater.installUpdate(), true);
    assert.deepEqual(openedPaths, [expectedPath]);
    assert.deepEqual(events, [
      'confirmBeforeQuitForUpdate',
      'shell.openPath',
      'onBeforeQuitForUpdate',
      'app.quit',
    ]);
  } finally {
    rmSync(downloadsDir, { recursive: true, force: true });
  }
});

test('auto updater mode respects confirmBeforeQuitForUpdate before quitAndInstall', async () => {
  const listeners = new Map();
  const events = [];
  let allowQuit = false;

  const mockAutoUpdater = {
    on(event, fn) {
      listeners.set(event, fn);
    },
    async checkForUpdates() {
      listeners.get('update-available')?.({ version: '0.2.0' });
    },
    async downloadUpdate() {
      listeners.get('update-downloaded')?.({ version: '0.2.0' });
    },
    quitAndInstall(isSilent, isForceRunAfter) {
      events.push(`quitAndInstall:${isSilent}:${isForceRunAfter}`);
    },
  };

  const updater = createDesktopUpdater({
    app: { isPackaged: true, getVersion: () => '0.1.0', getPath: () => os.tmpdir() },
    BrowserWindow: { getAllWindows: () => [] },
    net: { fetch: async () => new Response() },
    shell: { openExternal: async () => {}, openPath: async () => '' },
    autoUpdater: mockAutoUpdater,
    confirmBeforeQuitForUpdate: async () => {
      events.push('confirmBeforeQuitForUpdate');
      return allowQuit;
    },
    onBeforeQuitForUpdate: () => events.push('onBeforeQuitForUpdate'),
    platform: 'win32',
    arch: 'x64',
  });

  await updater.checkForUpdates({ silent: false });
  await updater.downloadUpdate();
  assert.equal(updater.getState().status, 'downloaded');

  allowQuit = false;
  assert.equal(await updater.installUpdate(), false);
  assert.deepEqual(events, ['confirmBeforeQuitForUpdate']);

  events.length = 0;
  allowQuit = true;
  assert.equal(await updater.installUpdate(), true);
  assert.deepEqual(events, [
    'confirmBeforeQuitForUpdate',
    'onBeforeQuitForUpdate',
    'quitAndInstall:false:true',
  ]);
});

