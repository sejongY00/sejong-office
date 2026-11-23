import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

const ICNS_TYPE_BY_SIZE = {
  16: 'icp4',
  32: 'icp5',
  64: 'icp6',
  128: 'ic07',
  256: 'ic08',
  512: 'ic09',
  1024: 'ic10',
};

/**
 * Wrap one or more square PNG buffers into an Apple .icns container.
 * Modern macOS supports raw PNG data inside ic07/ic08/ic09/ic10 chunks.
 */
export function buildIcnsFromPngs(pngBuffers) {
  if (!pngBuffers.length) {
    throw new Error('ICNS 생성에 최소 1개의 PNG가 필요합니다.');
  }
  const chunks = pngBuffers.map((buf) => {
    const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    const { width, height } = readPngDimensions(bytes);
    if (width !== height) {
      throw new Error(`정사각형 PNG만 ICNS로 변환할 수 있습니다 (${width}x${height}).`);
    }
    const osType = ICNS_TYPE_BY_SIZE[width];
    if (!osType) {
      throw new Error(`지원하지 않는 ICNS 해상도입니다: ${width}x${height}`);
    }
    return { osType, bytes };
  });

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

export function generateDesktopIcons(srcDir = iconsSrcDir, outDir = buildDir) {
  mkdirSync(outDir, { recursive: true });

  const app256 = readFileSync(path.join(srcDir, 'icon-256.png'));
  const app512 = readFileSync(path.join(srcDir, 'icon-512.png'));

  writeFileSync(path.join(outDir, 'icon.ico'), buildIcoFromPngs([app256]));
  writeFileSync(path.join(outDir, 'icon.icns'), buildIcnsFromPngs([app256, app512]));

  const fileIconNames = [
    'file-word',
    'file-excel',
    'file-csv',
    'file-powerpoint',
    'file-pdf',
    'file-hwp',
  ];

  for (const name of fileIconNames) {
    const png = readFileSync(path.join(srcDir, `${name}.png`));
    writeFileSync(path.join(outDir, `${name}.ico`), buildIcoFromPngs([png]));
    writeFileSync(path.join(outDir, `${name}.icns`), buildIcnsFromPngs([png]));
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  generateDesktopIcons();
  console.log('Generated desktop .icns and .ico icons in packages/desktop/build');
}
