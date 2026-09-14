import { wrapPngAsIco } from './ico';

export type PixelRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ExportFormat = 'image/jpeg' | 'image/webp' | 'image/png' | 'image/x-icon';

export type RatioFit = 'crop' | 'pad';

const MIN_CROP = 8;

export function loadImageFromUrl(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('이미지를 불러오지 못했습니다.'));
    image.src = url;
  });
}

export function clampCrop(
  crop: PixelRect,
  imageWidth: number,
  imageHeight: number,
): PixelRect {
  const maxW = Math.max(1, Math.floor(imageWidth));
  const maxH = Math.max(1, Math.floor(imageHeight));
  const width = Math.min(Math.max(MIN_CROP, Math.round(crop.width)), maxW);
  const height = Math.min(Math.max(MIN_CROP, Math.round(crop.height)), maxH);
  const x = Math.min(Math.max(0, Math.round(crop.x)), maxW - width);
  const y = Math.min(Math.max(0, Math.round(crop.y)), maxH - height);
  return { x, y, width, height };
}

export function fullImageCrop(imageWidth: number, imageHeight: number): PixelRect {
  return clampCrop(
    { x: 0, y: 0, width: imageWidth, height: imageHeight },
    imageWidth,
    imageHeight,
  );
}

/** Largest rectangle of `aspect` (width/height) that fits in the image. */
export function maxCropForAspect(
  imageWidth: number,
  imageHeight: number,
  aspect: number,
  center?: { x: number; y: number },
): PixelRect {
  if (!(aspect > 0) || !Number.isFinite(aspect)) {
    return fullImageCrop(imageWidth, imageHeight);
  }
  let width = imageWidth;
  let height = width / aspect;
  if (height > imageHeight) {
    height = imageHeight;
    width = height * aspect;
  }
  const cx = center?.x ?? imageWidth / 2;
  const cy = center?.y ?? imageHeight / 2;
  return clampCrop(
    { x: cx - width / 2, y: cy - height / 2, width, height },
    imageWidth,
    imageHeight,
  );
}

export function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function extensionForFormat(format: ExportFormat) {
  if (format === 'image/jpeg') return 'jpg';
  if (format === 'image/webp') return 'webp';
  if (format === 'image/x-icon') return 'ico';
  return 'png';
}

export function clampPixelSize(value: number) {
  return Math.min(8192, Math.max(1, Math.round(Number(value)) || 1));
}

function outputSize(
  srcWidth: number,
  srcHeight: number,
  scale: number,
  maxEdge: number | null,
  padAspect: number | null,
  targetWidth?: number | null,
  targetHeight?: number | null,
) {
  let width = Math.max(1, srcWidth);
  let height = Math.max(1, srcHeight);

  if (padAspect && padAspect > 0) {
    const current = width / height;
    if (current < padAspect) {
      width = height * padAspect;
    } else if (current > padAspect) {
      height = width / padAspect;
    }
  }

  if (
    targetWidth != null &&
    targetHeight != null &&
    targetWidth > 0 &&
    targetHeight > 0
  ) {
    width = targetWidth;
    height = targetHeight;
  } else {
    const factor = Math.min(8, Math.max(0.01, scale));
    width *= factor;
    height *= factor;
  }

  if (maxEdge && maxEdge > 0) {
    const cap = Math.min(1, maxEdge / width, maxEdge / height);
    width *= cap;
    height *= cap;
  }

  return {
    width: clampPixelSize(width),
    height: clampPixelSize(height),
  };
}

export function previewOutputSize(options: {
  crop: PixelRect;
  scale: number;
  maxEdge: number | null;
  padAspect: number | null;
  fit: RatioFit;
  targetWidth?: number | null;
  targetHeight?: number | null;
}) {
  const padAspect = options.fit === 'pad' ? options.padAspect : null;
  return outputSize(
    options.crop.width,
    options.crop.height,
    options.scale,
    options.maxEdge,
    padAspect,
    options.targetWidth,
    options.targetHeight,
  );
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  format: ExportFormat,
  quality: number,
) {
  const mime = format === 'image/x-icon' ? 'image/png' : format;
  return new Promise<Blob>((resolve, reject) => {
    const q =
      mime === 'image/png' ? undefined : Math.min(1, Math.max(0.01, quality));
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('이미지를 인코딩하지 못했습니다.'));
          return;
        }
        resolve(blob);
      },
      mime,
      q,
    );
  });
}

function parseCssColor(color: string): { r: number; g: number; b: number } {
  const hex = color.trim();
  const short = /^#([0-9a-f]{3})$/i.exec(hex);
  if (short) {
    const n = short[1];
    return {
      r: Number.parseInt(n[0] + n[0], 16),
      g: Number.parseInt(n[1] + n[1], 16),
      b: Number.parseInt(n[2] + n[2], 16),
    };
  }
  const full = /^#([0-9a-f]{6})$/i.exec(hex);
  if (full) {
    const n = full[1];
    return {
      r: Number.parseInt(n.slice(0, 2), 16),
      g: Number.parseInt(n.slice(2, 4), 16),
      b: Number.parseInt(n.slice(4, 6), 16),
    };
  }
  return { r: 255, g: 255, b: 255 };
}

export async function exportEditedImage(options: {
  image: HTMLImageElement;
  crop: PixelRect;
  scale: number;
  maxEdge: number | null;
  format: ExportFormat;
  quality: number;
  fit: RatioFit;
  padAspect: number | null;
  padColor: string;
  targetWidth?: number | null;
  targetHeight?: number | null;
  lockAspect?: boolean;
}): Promise<{ blob: Blob; width: number; height: number }> {
  const crop = clampCrop(
    options.crop,
    options.image.naturalWidth || options.image.width,
    options.image.naturalHeight || options.image.height,
  );
  const padAspect =
    options.fit === 'pad' && options.padAspect && options.padAspect > 0
      ? options.padAspect
      : null;
  const size = outputSize(
    crop.width,
    crop.height,
    options.scale,
    options.maxEdge,
    padAspect,
    options.targetWidth,
    options.targetHeight,
  );

  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('캔버스를 만들 수 없습니다.');

  if (options.format === 'image/jpeg' || padAspect) {
    const { r, g, b } = parseCssColor(options.padColor);
    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
    ctx.fillRect(0, 0, size.width, size.height);
  } else {
    ctx.clearRect(0, 0, size.width, size.height);
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const letterbox = Boolean(padAspect) && options.lockAspect !== false;
  if (letterbox) {
    const fitted = containSize(crop.width, crop.height, size.width, size.height);
    const dx = Math.round((size.width - fitted.width) / 2);
    const dy = Math.round((size.height - fitted.height) / 2);
    ctx.drawImage(
      options.image,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      dx,
      dy,
      fitted.width,
      fitted.height,
    );
  } else {
    ctx.drawImage(
      options.image,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      0,
      0,
      size.width,
      size.height,
    );
  }

  const blob = await canvasToBlob(canvas, options.format, options.quality);
  if (options.format === 'image/x-icon') {
    return {
      blob: wrapPngAsIco(await blob.arrayBuffer(), size.width, size.height),
      width: size.width,
      height: size.height,
    };
  }
  return { blob, width: size.width, height: size.height };
}

function containSize(
  srcW: number,
  srcH: number,
  boxW: number,
  boxH: number,
) {
  const scale = Math.min(boxW / srcW, boxH / srcH);
  return {
    width: Math.max(1, Math.round(srcW * scale)),
    height: Math.max(1, Math.round(srcH * scale)),
  };
}
