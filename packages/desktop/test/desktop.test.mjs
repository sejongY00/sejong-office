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
  resolveBundledOfficeAsset,
} = require('../src/offlineCache.cjs');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.resolve(__dirname, '..');
const frontendPublic = path.resolve(desktopRoot, '../frontend/public');

test('generateDesktopIcons builds valid .ico and .icns files for app and all 6 file types', () => {
  const tmpOut = mkdtempSync(path.join(os.tmpdir(), 'sejong-icons-'));
  try {
    generateDesktopIcons(path.join(frontendPublic, 'icons'), tmpOut);

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
      assert.ok(icoBytes.readUInt16LE(4) >= 1);

      const icnsBytes = readFileSync(icnsPath);
      assert.equal(icnsBytes.subarray(0, 4).toString('ascii'), 'icns');
      assert.equal(icnsBytes.readUInt32BE(4), icnsBytes.byteLength);
    }
  } finally {
    rmSync(tmpOut, { recursive: true, force: true });
  }
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
    '["NanumBarunGothic",181,0,-1,-1,182,0,-1,-1],',
    '["NanumGothic",183,0,-1,-1,184,0,-1,-1],',
    '["NanumMyeongjo",185,0,-1,-1,-1,-1,-1,-1],',
    '["NanumSquare",187,0,-1,-1,-1,-1,-1,-1]',
    '];',
    `window["g_fonts_selection_bin"] = "${base64}";`,
  ].join('\n');

  const patched = patchAllFontsSource(fakeAllFonts);
  assert.ok(patched.includes('__SEJONG_KR_FONTS_PATCHED__'));
  assert.ok(patched.includes('["NanumSquare",187,0,-1,-1,186,0,-1,-1]'));
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
  assert.ok(gothicRec.altNames.includes('맑은 고딕'));
  assert.ok(barunRec.altNames.includes('함초롬돋움'));
  assert.ok(myeongjoRec.altNames.includes('함초롬바탕'));
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

