import {
  createScanner,
  ensureJscanify,
  loadImageFromUrl,
} from './detect';
import type { CornerPoints, PaperAspect } from './types';

export const DEFAULT_SCAN_INTENSITY = 55;

function clampByte(value: number) {
  return Math.min(255, Math.max(0, Math.round(value)));
}

/** 스캔 강도(0–100): 대비·배경 미백·문서형 흑백 혼합 */
export function applyScanIntensity(
  canvas: HTMLCanvasElement,
  intensity: number,
) {
  const amount = Math.min(100, Math.max(0, intensity)) / 100;
  if (amount <= 0.001) return canvas;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return canvas;

  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = image;
  const contrast = 1 + amount * 1.45;
  const grayMix = amount * 0.9;
  const whitePush = amount * 0.42;
  const inkMix = Math.max(0, (amount - 0.55) / 0.45);

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i]!;
    let g = data[i + 1]!;
    let b = data[i + 2]!;
    const y = 0.299 * r + 0.587 * g + 0.114 * b;
    r = r * (1 - grayMix) + y * grayMix;
    g = g * (1 - grayMix) + y * grayMix;
    b = b * (1 - grayMix) + y * grayMix;

    r = (r - 128) * contrast + 128;
    g = (g - 128) * contrast + 128;
    b = (b - 128) * contrast + 128;

    if (whitePush > 0) {
      const lift = (v: number) =>
        v > 155 ? v + (255 - v) * whitePush * ((v - 155) / 100) : v;
      r = lift(r);
      g = lift(g);
      b = lift(b);
    }

    if (inkMix > 0) {
      const y2 = 0.299 * r + 0.587 * g + 0.114 * b;
      const ink = Math.max(0, Math.min(1, (175 - y2) / 85));
      const doc = 255 * (1 - ink) + 18 * ink;
      r = r * (1 - inkMix) + doc * inkMix;
      g = g * (1 - inkMix) + doc * inkMix;
      b = b * (1 - inkMix) + doc * inkMix;
    }

    data[i] = clampByte(r);
    data[i + 1] = clampByte(g);
    data[i + 2] = clampByte(b);
  }

  ctx.putImageData(image, 0, 0);
  return canvas;
}

export function outputSizeForAspect(
  aspect: PaperAspect,
  corners: CornerPoints,
) {
  if (aspect === 'a4-portrait') return { width: 1240, height: 1754 };
  if (aspect === 'a4-landscape') return { width: 1754, height: 1240 };
  if (aspect === 'square') return { width: 1400, height: 1400 };

  const widthTop = Math.hypot(
    corners.topRightCorner.x - corners.topLeftCorner.x,
    corners.topRightCorner.y - corners.topLeftCorner.y,
  );
  const widthBottom = Math.hypot(
    corners.bottomRightCorner.x - corners.bottomLeftCorner.x,
    corners.bottomRightCorner.y - corners.bottomLeftCorner.y,
  );
  const heightLeft = Math.hypot(
    corners.bottomLeftCorner.x - corners.topLeftCorner.x,
    corners.bottomLeftCorner.y - corners.topLeftCorner.y,
  );
  const heightRight = Math.hypot(
    corners.bottomRightCorner.x - corners.topRightCorner.x,
    corners.bottomRightCorner.y - corners.topRightCorner.y,
  );
  const width = Math.max(widthTop, widthBottom, 1);
  const height = Math.max(heightLeft, heightRight, 1);
  const scale = Math.min(1800 / width, 1800 / height, 1);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export async function warpImage(
  sourceUrl: string,
  corners: CornerPoints,
  aspect: PaperAspect,
  scanIntensity: number = DEFAULT_SCAN_INTENSITY,
) {
  await ensureJscanify();
  const image = await loadImageFromUrl(sourceUrl);
  const size = outputSizeForAspect(aspect, corners);
  const scanner = createScanner();
  const canvas = scanner.extractPaper(
    image,
    size.width,
    size.height,
    corners,
  );
  if (!canvas) {
    throw new Error('문서 영역을 추출하지 못했습니다.');
  }
  applyScanIntensity(canvas, scanIntensity);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (value) =>
        value
          ? resolve(value)
          : reject(new Error('보정 이미지를 만들지 못했습니다.')),
      'image/png',
    );
  });
  return {
    blob,
    width: canvas.width,
    height: canvas.height,
    url: URL.createObjectURL(blob),
  };
}
