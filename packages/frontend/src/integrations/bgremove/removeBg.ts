export type BgRemoveMode = 'threshold' | 'flood';

export interface BgRemoveOptions {
  /** 0–100: how far from sampled background still counts as background */
  tolerance: number;
  /** 0–100: soft edge width beyond hard threshold */
  feather: number;
  mode: BgRemoveMode;
}

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export const DEFAULT_BG_REMOVE_OPTIONS: BgRemoveOptions = {
  tolerance: 28,
  feather: 12,
  mode: 'threshold',
};

function clampByte(value: number) {
  return Math.min(255, Math.max(0, Math.round(value)));
}

function colorDistance(a: Rgb, r: number, g: number, b: number) {
  return Math.max(Math.abs(r - a.r), Math.abs(g - a.g), Math.abs(b - a.b));
}

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]!
    : Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
}

/** Sample corner neighborhoods and take per-channel median as background. */
export function sampleCornerBackground(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  radius = 2,
): Rgb {
  const rs: number[] = [];
  const gs: number[] = [];
  const bs: number[] = [];
  const corners: Array<[number, number]> = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
  ];

  for (const [cx, cy] of corners) {
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        const x = Math.min(width - 1, Math.max(0, cx + dx));
        const y = Math.min(height - 1, Math.max(0, cy + dy));
        const i = (y * width + x) * 4;
        rs.push(data[i]!);
        gs.push(data[i + 1]!);
        bs.push(data[i + 2]!);
      }
    }
  }

  return { r: median(rs), g: median(gs), b: median(bs) };
}

function hardLimit(tolerance: number) {
  return Math.round((Math.min(100, Math.max(0, tolerance)) / 100) * 180);
}

function featherWidth(feather: number) {
  return Math.round((Math.min(100, Math.max(0, feather)) / 100) * 80);
}

function alphaForDistance(
  distance: number,
  hard: number,
  soft: number,
  originalAlpha: number,
) {
  if (distance <= hard) return 0;
  if (soft <= 0 || distance >= hard + soft) return originalAlpha;
  const t = (distance - hard) / soft;
  return clampByte(originalAlpha * t);
}

function loadImage(source: string | Blob | HTMLImageElement | HTMLCanvasElement) {
  if (source instanceof HTMLCanvasElement) {
    return Promise.resolve(source);
  }
  if (source instanceof HTMLImageElement) {
    if (source.complete && source.naturalWidth) return Promise.resolve(source);
    return new Promise<HTMLImageElement>((resolve, reject) => {
      source.onload = () => resolve(source);
      source.onerror = () =>
        reject(new Error('이미지를 불러오지 못했습니다.'));
    });
  }

  const objectUrl =
    typeof source === 'string' ? null : URL.createObjectURL(source);
  const src = typeof source === 'string' ? source : objectUrl!;
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      reject(new Error('이미지를 불러오지 못했습니다.'));
    };
    image.src = src;
  });
}

function drawToCanvas(
  image: HTMLImageElement | HTMLCanvasElement,
): HTMLCanvasElement {
  if (image instanceof HTMLCanvasElement) {
    const copy = document.createElement('canvas');
    copy.width = image.width;
    copy.height = image.height;
    const ctx = copy.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Canvas를 초기화하지 못했습니다.');
    ctx.drawImage(image, 0, 0);
    return copy;
  }
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas를 초기화하지 못했습니다.');
  ctx.drawImage(image, 0, 0);
  return canvas;
}

function applyThreshold(
  data: Uint8ClampedArray,
  bg: Rgb,
  hard: number,
  soft: number,
) {
  for (let i = 0; i < data.length; i += 4) {
    const d = colorDistance(bg, data[i]!, data[i + 1]!, data[i + 2]!);
    data[i + 3] = alphaForDistance(d, hard, soft, data[i + 3]!);
  }
}

function applyFlood(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  bg: Rgb,
  hard: number,
  soft: number,
) {
  const total = width * height;
  const match = new Uint8Array(total);
  const limit = hard + soft;
  for (let p = 0; p < total; p += 1) {
    const i = p * 4;
    const d = colorDistance(bg, data[i]!, data[i + 1]!, data[i + 2]!);
    if (d <= limit) match[p] = 1;
  }

  const visited = new Uint8Array(total);
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;

  const seed = (x: number, y: number) => {
    const p = y * width + x;
    if (!match[p] || visited[p]) return;
    visited[p] = 1;
    queue[tail++] = p;
  };

  seed(0, 0);
  seed(width - 1, 0);
  seed(0, height - 1);
  seed(width - 1, height - 1);

  while (head < tail) {
    const p = queue[head++]!;
    const x = p % width;
    const y = (p / width) | 0;
    if (x > 0) seed(x - 1, y);
    if (x + 1 < width) seed(x + 1, y);
    if (y > 0) seed(x, y - 1);
    if (y + 1 < height) seed(x, y + 1);
  }

  for (let p = 0; p < total; p += 1) {
    if (!visited[p]) continue;
    const i = p * 4;
    const d = colorDistance(bg, data[i]!, data[i + 1]!, data[i + 2]!);
    data[i + 3] = alphaForDistance(d, hard, soft, data[i + 3]!);
  }
}

export async function removeBackgroundBySample(
  source: string | Blob | HTMLImageElement | HTMLCanvasElement,
  options: Partial<BgRemoveOptions> = {},
): Promise<{
  blob: Blob;
  url: string;
  width: number;
  height: number;
  background: Rgb;
}> {
  const opts = { ...DEFAULT_BG_REMOVE_OPTIONS, ...options };
  const image = await loadImage(source);
  const canvas = drawToCanvas(image);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas를 초기화하지 못했습니다.');

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data, width, height } = imageData;
  const background = sampleCornerBackground(data, width, height);
  const hard = hardLimit(opts.tolerance);
  const soft = featherWidth(opts.feather);

  if (opts.mode === 'flood') {
    applyFlood(data, width, height, background, hard, soft);
  } else {
    applyThreshold(data, background, hard, soft);
  }

  ctx.putImageData(imageData, 0, 0);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (value) =>
        value
          ? resolve(value)
          : reject(new Error('투명 PNG를 만들지 못했습니다.')),
      'image/png',
    );
  });

  return {
    blob,
    url: URL.createObjectURL(blob),
    width: canvas.width,
    height: canvas.height,
    background,
  };
}
