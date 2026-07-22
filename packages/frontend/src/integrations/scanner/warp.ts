import {
  createScanner,
  ensureJscanify,
  loadImageFromUrl,
} from './detect';
import type { CornerPoints, PaperAspect } from './types';

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
