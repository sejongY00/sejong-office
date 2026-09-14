const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export function isIcoFile(file: File) {
  return (
    /image\/(x-icon|vnd\.microsoft\.icon|icon)/i.test(file.type) ||
    /\.ico$/i.test(file.name)
  );
}

function isPng(bytes: Uint8Array) {
  return (
    bytes.length >= 8 && PNG_SIG.every((value, index) => bytes[index] === value)
  );
}

function rowStride(width: number, bits: number) {
  return (((width * bits + 31) >> 5) << 2);
}

function decodeDib(bytes: Uint8Array): ImageData {
  if (bytes.length < 40) {
    throw new Error('ICO 비트맵 헤더가 올바르지 않습니다.');
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const headerSize = view.getUint32(0, true);
  if (headerSize < 40) {
    throw new Error('지원하지 않는 ICO 비트맵입니다.');
  }
  const width = Math.abs(view.getInt32(4, true));
  const rawHeight = view.getInt32(8, true);
  const bitCount = view.getUint16(14, true);
  const compression = view.getUint32(16, true);
  if (!(width > 0) || compression !== 0) {
    throw new Error('압축된 ICO 비트맵은 열 수 없습니다.');
  }

  const storedHeight = Math.abs(rawHeight) || 1;
  const bottomUp = rawHeight >= 0;
  const paletteColors =
    bitCount <= 8
      ? view.getUint32(32, true) || 1 << bitCount
      : 0;
  let offset = headerSize + paletteColors * 4;
  const xorStride = rowStride(width, bitCount);
  const remaining = Math.max(0, bytes.length - offset);
  let height = storedHeight;
  if (storedHeight % 2 === 0) {
    const half = storedHeight / 2;
    const xorHalf = xorStride * half;
    const andHalf = rowStride(width, 1) * half;
    if (xorHalf + andHalf <= remaining || xorHalf <= remaining) {
      height = half;
    }
  }
  const xorSize = xorStride * height;
  if (!(height > 0) || offset + xorSize > bytes.length) {
    throw new Error('ICO 비트맵 데이터가 잘렸습니다.');
  }

  const palette: Array<[number, number, number, number]> = [];
  for (let i = 0; i < paletteColors; i += 1) {
    const p = headerSize + i * 4;
    palette.push([bytes[p + 2]!, bytes[p + 1]!, bytes[p]!, 255]);
  }

  const pixels = new Uint8ClampedArray(width * height * 4);
  const andOffset = offset + xorSize;
  const andStride = rowStride(width, 1);
  const hasAnd = andOffset + andStride * height <= bytes.length;

  function xorPixel(x: number, y: number): [number, number, number, number] {
    const row = bottomUp ? height - 1 - y : y;
    const rowStart = offset + row * xorStride;
    if (bitCount === 32) {
      const i = rowStart + x * 4;
      return [bytes[i + 2]!, bytes[i + 1]!, bytes[i]!, bytes[i + 3]!];
    }
    if (bitCount === 24) {
      const i = rowStart + x * 3;
      return [bytes[i + 2]!, bytes[i + 1]!, bytes[i]!, 255];
    }
    if (bitCount === 8) {
      return palette[bytes[rowStart + x]!] ?? [0, 0, 0, 255];
    }
    if (bitCount === 4) {
      const byte = bytes[rowStart + (x >> 1)]!;
      const index = x & 1 ? byte & 0x0f : byte >> 4;
      return palette[index] ?? [0, 0, 0, 255];
    }
    if (bitCount === 1) {
      const byte = bytes[rowStart + (x >> 3)]!;
      const index = (byte >> (7 - (x & 7))) & 1;
      return palette[index] ?? [0, 0, 0, 255];
    }
    throw new Error(`지원하지 않는 ICO 색 깊이입니다 (${bitCount}bit).`);
  }

  function andTransparent(x: number, y: number) {
    if (!hasAnd) return false;
    const row = bottomUp ? height - 1 - y : y;
    const byte = bytes[andOffset + row * andStride + (x >> 3)]!;
    return ((byte >> (7 - (x & 7))) & 1) === 1;
  }

  let anyAlpha = false;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [r, g, b, a] = xorPixel(x, y);
      if (a > 0 && a < 255) anyAlpha = true;
      if (a === 255) anyAlpha = anyAlpha || bitCount === 32;
      const i = (y * width + x) * 4;
      pixels[i] = r;
      pixels[i + 1] = g;
      pixels[i + 2] = b;
      pixels[i + 3] = a;
    }
  }

  const useAnd = bitCount < 32 || !anyAlpha;
  if (useAnd) {
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (andTransparent(x, y)) {
          pixels[(y * width + x) * 4 + 3] = 0;
        }
      }
    }
  }

  return new ImageData(pixels, width, height);
}

function canvasFromImageData(data: ImageData) {
  const canvas = document.createElement('canvas');
  canvas.width = data.width;
  canvas.height = data.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('캔버스를 만들 수 없습니다.');
  ctx.putImageData(data, 0, 0);
  return canvas;
}

function pngBlobFromCanvas(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error('ICO를 PNG로 바꾸지 못했습니다.')),
      'image/png',
    );
  });
}

export function wrapPngAsIco(png: ArrayBuffer, width: number, height: number) {
  const header = 22;
  const out = new Uint8Array(header + png.byteLength);
  const view = new DataView(out.buffer);
  view.setUint16(0, 0, true);
  view.setUint16(2, 1, true);
  view.setUint16(4, 1, true);
  out[6] = width >= 256 ? 0 : width;
  out[7] = height >= 256 ? 0 : height;
  view.setUint16(10, 1, true);
  view.setUint16(12, 32, true);
  view.setUint32(14, png.byteLength, true);
  view.setUint32(18, header, true);
  out.set(new Uint8Array(png), header);
  return new Blob([out], { type: 'image/x-icon' });
}

async function decodeEntry(bytes: Uint8Array) {
  if (isPng(bytes)) {
    const blob = new Blob([bytes.slice()], { type: 'image/png' });
    const url = URL.createObjectURL(blob);
    try {
      const image = new Image();
      image.decoding = 'async';
      image.src = url;
      await image.decode();
      return {
        blob,
        width: image.naturalWidth || image.width,
        height: image.naturalHeight || image.height,
      };
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  const canvas = canvasFromImageData(decodeDib(bytes));
  const blob = await pngBlobFromCanvas(canvas);
  return { blob, width: canvas.width, height: canvas.height };
}

/** Decode an ICO and return the largest image as a PNG blob. */
export async function decodeIcoToPng(buffer: ArrayBuffer) {
  const view = new DataView(buffer);
  if (view.byteLength < 22) {
    throw new Error('ICO 파일이 너무 짧습니다.');
  }
  const reserved = view.getUint16(0, true);
  const type = view.getUint16(2, true);
  const count = view.getUint16(4, true);
  if (reserved !== 0 || (type !== 1 && type !== 2) || count < 1) {
    throw new Error('올바른 ICO 파일이 아닙니다.');
  }

  const bytes = new Uint8Array(buffer);
  let best: { score: number; offset: number; size: number } | null = null;
  for (let i = 0; i < count; i += 1) {
    const entry = 6 + i * 16;
    const width = view.getUint8(entry) || 256;
    const height = view.getUint8(entry + 1) || 256;
    const size = view.getUint32(entry + 8, true);
    const offset = view.getUint32(entry + 12, true);
    if (offset + size > buffer.byteLength) continue;
    const score = width * height + size;
    if (!best || score > best.score) {
      best = { score, offset, size };
    }
  }
  if (!best) {
    throw new Error('ICO에서 이미지를 찾지 못했습니다.');
  }

  const slice = bytes.subarray(best.offset, best.offset + best.size);
  const decoded = await decodeEntry(slice);
  return { ...decoded, imageCount: count };
}
