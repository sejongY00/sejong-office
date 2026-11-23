import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.resolve(__dirname, '..');
const iconsSrcDir = path.resolve(desktopRoot, '../frontend/public/icons');
const buildDir = path.resolve(desktopRoot, 'build');

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Read width and height from a PNG IHDR chunk and verify PNG signature. */
export function readPngDimensions(pngBytes) {
  if (
    pngBytes.byteLength < 24 ||
    !PNG_SIG.every((byte, idx) => pngBytes[idx] === byte)
  ) {
    throw new Error('유효한 PNG 파일이 아닙니다.');
  }
  const view = new DataView(
    pngBytes.buffer,
    pngBytes.byteOffset,
    pngBytes.byteLength,
  );
  const width = view.getUint32(16, false);
  const height = view.getUint32(20, false);
  return { width, height };
}

/**
 * Wrap one or more PNG buffers into a Windows .ico container.
 * Uses the same PNG-in-ICO header layout as `wrapPngAsIco` in frontend/src/integrations/imageedit/ico.ts.
 */
export function buildIcoFromPngs(pngBuffers) {
  if (!pngBuffers.length) {
    throw new Error('ICO 생성에 최소 1개의 PNG가 필요합니다.');
  }
  const entries = pngBuffers.map((buf) => {
    const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    const { width, height } = readPngDimensions(bytes);
    return { bytes, width, height };
  });

  const headerSize = 6 + entries.length * 16;
  const totalSize =
    headerSize + entries.reduce((sum, item) => sum + item.bytes.byteLength, 0);
  const out = new Uint8Array(totalSize);
  const view = new DataView(out.buffer);

  // ICONDIR header
  view.setUint16(0, 0, true); // reserved
  view.setUint16(2, 1, true); // type = 1 (ICO)
  view.setUint16(4, entries.length, true); // count

  let dataOffset = headerSize;
  entries.forEach((entry, idx) => {
    const dirOffset = 6 + idx * 16;
    out[dirOffset] = entry.width >= 256 ? 0 : entry.width;
    out[dirOffset + 1] = entry.height >= 256 ? 0 : entry.height;
    out[dirOffset + 2] = 0; // color palette
    out[dirOffset + 3] = 0; // reserved
    view.setUint16(dirOffset + 4, 1, true); // color planes
    view.setUint16(dirOffset + 6, 32, true); // bits per pixel
    view.setUint32(dirOffset + 8, entry.bytes.byteLength, true);
    view.setUint32(dirOffset + 12, dataOffset, true);
    out.set(entry.bytes, dataOffset);
    dataOffset += entry.bytes.byteLength;
  });

  return out;
}

/**
 * Apple PNG-in-ICNS OSTypes that macOS IconServices/iconutil decode natively as PNG.
 * Note: `icp4` (16x16) and `icp5` (32x32) are NOT safe for raw PNG payloads in macOS Finder
 * (macOS treats them as PackBits ARGB, causing rainbow static in 16px list views).
 */
const ICNS_TYPES_BY_SIZE = {
  32: ['ic11'],
  64: ['ic12'],
  128: ['ic07'],
  256: ['ic08', 'ic13'],
  512: ['ic09', 'ic14'],
  1024: ['ic10'],
};

const ICONSET_FILES_BY_SIZE = [
  { file: 'icon_16x16.png', size: 16 },
  { file: 'icon_16x16@2x.png', size: 32 },
  { file: 'icon_32x32.png', size: 32 },
  { file: 'icon_32x32@2x.png', size: 64 },
  { file: 'icon_128x128.png', size: 128 },
  { file: 'icon_128x128@2x.png', size: 256 },
  { file: 'icon_256x256.png', size: 256 },
  { file: 'icon_256x256@2x.png', size: 512 },
  { file: 'icon_512x512.png', size: 512 },
  { file: 'icon_512x512@2x.png', size: 1024 },
];

/**
 * On macOS, use Apple's native `iconutil` so 16x16 (`ic04`) and 32x32 (`ic05`) are encoded
 * in Apple's native ARGB format alongside PNG Retina chunks. Falls back to `buildIcnsFromPngs`
 * on non-macOS hosts.
 */
function buildNativeOrPortableIcns(sizeMap, icnsSizes) {
  if (process.platform === 'darwin' && sizeMap.has(16) && sizeMap.has(32) && sizeMap.has(128)) {
    const tmpRoot = mkdtempSync(path.join(os.tmpdir(), 'sejong-iconutil-'));
    try {
      const iconsetDir = path.join(tmpRoot, 'app.iconset');
      const outIcns = path.join(tmpRoot, 'app.icns');
      mkdirSync(iconsetDir, { recursive: true });
      for (const { file, size } of ICONSET_FILES_BY_SIZE) {
        const buf = sizeMap.get(size);
        if (buf) writeFileSync(path.join(iconsetDir, file), buf);
      }
      execFileSync('iconutil', ['-c', 'icns', iconsetDir, '-o', outIcns], { stdio: 'ignore' });
      return readFileSync(outIcns);
    } catch {
      // Fall back to pure-JS portable PNG-in-ICNS builder below
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  }
  return buildIcnsFromPngs(
    icnsSizes
      .filter((s) => ICNS_TYPES_BY_SIZE[s])
      .map((s) => sizeMap.get(s))
      .filter(Boolean),
  );
}

/**
 * Wrap one or more square PNG buffers into an Apple .icns container.
 * Emits both standard (1x) and Retina (2x: ic11/ic12/ic13/ic14) PNG-in-ICNS chunks so
 * macOS Finder & IconServices have exact pixel representations at every display scale.
 */
export function buildIcnsFromPngs(pngBuffers) {
  if (!pngBuffers.length) {
    throw new Error('ICNS 생성에 최소 1개의 PNG가 필요합니다.');
  }
  const chunks = [];
  for (const buf of pngBuffers) {
    const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    const { width, height } = readPngDimensions(bytes);
    if (width !== height) {
      throw new Error(`정사각형 PNG만 ICNS로 변환할 수 있습니다 (${width}x${height}).`);
    }
    const osTypes = ICNS_TYPES_BY_SIZE[width];
    if (!osTypes) {
      throw new Error(`지원하지 않는 ICNS 해상도입니다: ${width}x${height}`);
    }
    for (const osType of osTypes) {
      chunks.push({ osType, bytes });
    }
  }

  const totalSize =
    8 + chunks.reduce((sum, chunk) => sum + 8 + chunk.bytes.byteLength, 0);
  const out = new Uint8Array(totalSize);
  const view = new DataView(out.buffer);

  // 'icns' magic + total length (big-endian)
  out.set([0x69, 0x63, 0x6e, 0x73], 0);
  view.setUint32(4, totalSize, false);

  let offset = 8;
  for (const chunk of chunks) {
    for (let i = 0; i < 4; i += 1) {
      out[offset + i] = chunk.osType.charCodeAt(i);
    }
    view.setUint32(offset + 4, 8 + chunk.bytes.byteLength, false);
    out.set(chunk.bytes, offset + 8);
    offset += 8 + chunk.bytes.byteLength;
  }

  return out;
}

function loadSharp() {
  try {
    return require('sharp');
  } catch {
    return null;
  }
}

async function resizePngMap(sourcePng, sizes) {
  const sharp = loadSharp();
  const { width: srcWidth } = readPngDimensions(sourcePng);
  const map = new Map();
  map.set(srcWidth, sourcePng);

  if (!sharp) {
    return map;
  }

  for (const size of sizes) {
    if (map.has(size)) continue;
    const resized = await sharp(sourcePng)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    map.set(size, resized);
  }
  return map;
}

export async function generateDesktopIcons(srcDir = iconsSrcDir, outDir = buildDir) {
  mkdirSync(outDir, { recursive: true });

  const icoSizes = [16, 24, 32, 48, 64, 128, 256];
  const icnsSizes = [16, 32, 64, 128, 256, 512, 1024];

  const app512 = readFileSync(path.join(srcDir, 'icon-512.png'));
  const appMap = await resizePngMap(app512, [...new Set([...icoSizes, ...icnsSizes])]);
  appMap.set(256, readFileSync(path.join(srcDir, 'icon-256.png')));

  writeFileSync(
    path.join(outDir, 'icon.ico'),
    buildIcoFromPngs(icoSizes.map((s) => appMap.get(s)).filter(Boolean)),
  );
  writeFileSync(
    path.join(outDir, 'icon.icns'),
    buildNativeOrPortableIcns(appMap, icnsSizes),
  );

  const fileIconNames = [
    'file-word',
    'file-excel',
    'file-csv',
    'file-powerpoint',
    'file-pdf',
    'file-hwp',
  ];

  for (const name of fileIconNames) {
    const srcPng = readFileSync(path.join(srcDir, `${name}.png`));
    const sizeMap = await resizePngMap(srcPng, [...new Set([...icoSizes, ...icnsSizes])]);
    writeFileSync(
      path.join(outDir, `${name}.ico`),
      buildIcoFromPngs(icoSizes.map((s) => sizeMap.get(s)).filter(Boolean)),
    );
    writeFileSync(
      path.join(outDir, `${name}.icns`),
      buildNativeOrPortableIcns(sizeMap, icnsSizes),
    );
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await generateDesktopIcons();
  console.log('Generated multi-resolution desktop .icns and .ico icons in packages/desktop/build');
}
