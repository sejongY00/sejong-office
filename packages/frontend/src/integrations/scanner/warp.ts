import { ensureOpenCv, loadImageFromUrl } from './detect';
import type { CornerPoints, PaperAspect, ScanMode } from './types';

/** 0 = 은은하게 · 100 = 글자를 아주 진하고 선명하게 (조명 평탄화는 강도와 무관하게 항상) */
export const DEFAULT_SCAN_INTENSITY = 60;
export const DEFAULT_SCAN_MODE: ScanMode = 'color';

const A_RATIO = Math.SQRT2; // A 계열 용지 (A4 등)
const LETTER_RATIO = 11 / 8.5;
/** 원본이 이보다 크면 줄여서 처리 (48MP 사진 등에서 WASM 메모리 부족 방지) */
const MAX_SOURCE_SIDE = 4096;

// jscanify에 들어 있는 OpenCV.js(4.7)에는 타입 정의가 없다
type Cv = any;
type Mat = any;

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);
const odd = (n: number) => Math.round(n) | 1;

function edgeAspect(c: CornerPoints) {
  const w =
    (dist(c.topLeftCorner, c.topRightCorner) +
      dist(c.bottomLeftCorner, c.bottomRightCorner)) /
    2;
  const h =
    (dist(c.topLeftCorner, c.bottomLeftCorner) +
      dist(c.topRightCorner, c.bottomRightCorner)) /
    2;
  return w / Math.max(h, 1);
}

/**
 * 원근을 고려한 실제 용지 가로/세로 비.
 * 비스듬히 찍으면 먼 쪽 변이 짧아져 변 길이만으로는 비율이 크게 틀어진다(늘어난 듯한 결과).
 * Zhang & He, "Whiteboard scanning and image enhancement"(2007) — 주점은 사진 중앙으로 가정.
 * 정면에 가깝거나 값이 불안정하면 변 길이 평균으로 대신한다.
 */
export function estimateAspect(
  c: CornerPoints,
  imageWidth: number,
  imageHeight: number,
) {
  type V3 = [number, number, number];
  const u0 = imageWidth / 2;
  const v0 = imageHeight / 2;
  const p = (pt: { x: number; y: number }): V3 => [pt.x - u0, pt.y - v0, 1];
  const cross = (a: V3, b: V3): V3 => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const m1 = p(c.topLeftCorner);
  const m2 = p(c.topRightCorner);
  const m3 = p(c.bottomLeftCorner);
  const m4 = p(c.bottomRightCorner);
  const c14 = cross(m1, m4);
  const k2 = dot(c14, m3) / dot(cross(m2, m4), m3);
  const k3 = dot(c14, m2) / dot(cross(m3, m4), m2);
  const n2 = m2.map((v, i) => k2 * v - m1[i]!) as V3;
  const n3 = m3.map((v, i) => k3 * v - m1[i]!) as V3;
  const denom = n2[2] * n3[2];
  if (!Number.isFinite(k2) || !Number.isFinite(k3) || Math.abs(denom) < 1e-9) {
    return edgeAspect(c);
  }
  const f2 = -(n2[0] * n3[0] + n2[1] * n3[1]) / denom;
  const maxDim = Math.max(imageWidth, imageHeight);
  if (!(f2 > 0) || Math.sqrt(f2) < maxDim * 0.3 || Math.sqrt(f2) > maxDim * 6) {
    return edgeAspect(c);
  }
  const ratio = Math.sqrt(
    (n2[0] ** 2 + n2[1] ** 2 + n2[2] ** 2 * f2) /
      (n3[0] ** 2 + n3[1] ** 2 + n3[2] ** 2 * f2),
  );
  return Number.isFinite(ratio) && ratio > 0.15 && ratio < 7
    ? ratio
    : edgeAspect(c);
}

/** 흔한 용지 비율(A 계열, Letter)과 4% 안쪽이면 그 비율로 맞춘다 */
function snapAspect(ratio: number) {
  for (const target of [A_RATIO, LETTER_RATIO]) {
    for (const t of [target, 1 / target]) {
      if (Math.abs(ratio / t - 1) < 0.04) return t;
    }
  }
  return ratio;
}

/** 결과 크기: 비율은 용지 설정(자동이면 원근 추정), 긴 변은 원본에서 문서가 차지한 픽셀 수 기준
 *  (1754–3508px = A4 150–300dpi, 원본보다 크게 늘리지 않음) */
export function outputSizeForAspect(
  aspect: PaperAspect,
  corners: CornerPoints,
  imageWidth: number,
  imageHeight: number,
) {
  let ratio: number;
  if (aspect === 'a4-portrait') ratio = 1 / A_RATIO;
  else if (aspect === 'a4-landscape') ratio = A_RATIO;
  else if (aspect === 'square') ratio = 1;
  else ratio = snapAspect(estimateAspect(corners, imageWidth, imageHeight));
  const sourceLong = Math.max(
    dist(corners.topLeftCorner, corners.topRightCorner),
    dist(corners.bottomLeftCorner, corners.bottomRightCorner),
    dist(corners.topLeftCorner, corners.bottomLeftCorner),
    dist(corners.topRightCorner, corners.bottomRightCorner),
  );
  const long = Math.round(Math.min(3508, Math.max(1754, sourceLong * 1.1)));
  return ratio >= 1
    ? { width: long, height: Math.max(1, Math.round(long / ratio)) }
    : { width: Math.max(1, Math.round(long * ratio)), height: long };
}

/** 원근 보정 (RGB → RGB). 가장자리는 늘려 채워 검은 테두리가 생기지 않게 한다 */
function warpMat(
  cv: Cv,
  src: Mat,
  c: CornerPoints,
  size: { width: number; height: number },
) {
  const from = cv.matFromArray(4, 1, cv.CV_32FC2, [
    c.topLeftCorner.x, c.topLeftCorner.y,
    c.topRightCorner.x, c.topRightCorner.y,
    c.bottomRightCorner.x, c.bottomRightCorner.y,
    c.bottomLeftCorner.x, c.bottomLeftCorner.y,
  ]);
  // 가장자리를 0.4% 안쪽으로 잘라 코너 오차로 섞여 든 책상·그림자 테두리를 없앤다
  const m = Math.round(Math.max(size.width, size.height) * 0.004);
  const to = cv.matFromArray(4, 1, cv.CV_32FC2, [
    -m, -m, size.width + m, -m, size.width + m, size.height + m, -m, size.height + m,
  ]);
  const transform = cv.getPerspectiveTransform(from, to);
  const out = new cv.Mat();
  cv.warpPerspective(
    src, out, transform, new cv.Size(size.width, size.height),
    cv.INTER_CUBIC, cv.BORDER_REPLICATE,
  );
  from.delete();
  to.delete();
  transform.delete();
  return out;
}

/**
 * 조명 평탄화: 글자를 지운 종이 배경(밝은 쪽 팽창 + 메디안 블러)을 추정해 원본을 나눈다.
 * 그림자·밝기 차이·누런 조명이 사라지고 종이는 흰색, 도장·서명 같은 색은 남는다.
 */
function flatten(cv: Cv, src: Mat) {
  const scale = Math.min(1, 640 / Math.max(src.cols, src.rows));
  const small = new cv.Mat();
  cv.resize(
    src, small,
    new cv.Size(Math.round(src.cols * scale), Math.round(src.rows * scale)),
    0, 0, cv.INTER_AREA,
  );
  const kernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(9, 9));
  cv.dilate(small, small, kernel);
  cv.medianBlur(small, small, 31);
  cv.GaussianBlur(small, small, new cv.Size(0, 0), 3);
  const background = new cv.Mat();
  cv.resize(small, background, new cv.Size(src.cols, src.rows), 0, 0, cv.INTER_LINEAR);
  const out = new cv.Mat();
  cv.divide(src, background, out, 255);
  small.delete();
  kernel.delete();
  background.delete();
  return out;
}

/** 레벨 보정: 잉크 쪽 하위 blackPct를 0으로 당기고 감마로 글자를 진하게 (이 빌드에는 cv.LUT가 없다) */
function levels(mat: Mat, blackPct: number, gamma: number, whiteAt = 245) {
  const data = mat.data as Uint8Array;
  const hist = new Uint32Array(256);
  for (let i = 0; i < data.length; i += 1) hist[data[i]!] += 1;
  const target = data.length * blackPct;
  let acc = 0;
  let black = 0;
  for (let v = 0; v < 256; v += 1) {
    acc += hist[v]!;
    if (acc >= target) {
      black = v;
      break;
    }
  }
  black = Math.min(black, whiteAt - 40);
  const lut = new Uint8Array(256);
  for (let v = 0; v < 256; v += 1) {
    const t = Math.min(1, Math.max(0, (v - black) / (whiteAt - black)));
    lut[v] = Math.round(255 * t ** gamma);
  }
  for (let i = 0; i < data.length; i += 1) data[i] = lut[data[i]!]!;
}

function sharpen(cv: Cv, mat: Mat, amount: number) {
  const blur = new cv.Mat();
  cv.GaussianBlur(mat, blur, new cv.Size(0, 0), 1.1);
  cv.addWeighted(mat, 1 + amount, blur, -amount, 0, mat);
  blur.delete();
}

/** 스캔 필터. 원본: 원근 보정만 · 컬러/회색조: 조명 평탄화 + 글자 진하게 + 선명 · 흑백: 적응형 이진화 */
function enhance(cv: Cv, src: Mat, mode: ScanMode, intensity: number) {
  const a = Math.min(100, Math.max(0, intensity)) / 100;
  if (mode === 'original') return src.clone();
  let base = src;
  if (mode === 'gray' || mode === 'bw') {
    base = new cv.Mat();
    cv.cvtColor(src, base, cv.COLOR_RGB2GRAY);
  }
  const flat = flatten(cv, base);
  if (base !== src) base.delete();
  if (mode === 'bw') {
    const out = new cv.Mat();
    cv.adaptiveThreshold(
      flat, out, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY,
      odd(Math.max(flat.cols, flat.rows) / 70), 6 + 14 * a,
    );
    flat.delete();
    return out;
  }
  levels(flat, 0.002 + 0.02 * a, 1 + 0.6 * a);
  sharpen(cv, flat, 0.3 + 0.5 * a);
  return flat;
}

/** 원본을 캔버스에 그린다. 너무 크면 줄이고 그 배율을 돌려준다 */
function sourceCanvas(image: HTMLImageElement) {
  const w = image.naturalWidth || image.width;
  const h = image.naturalHeight || image.height;
  const scale = Math.min(1, MAX_SOURCE_SIDE / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas를 초기화하지 못했습니다.');
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return { canvas, scale };
}

function scaleCorners(c: CornerPoints, s: number): CornerPoints {
  const f = (p: { x: number; y: number }) => ({ x: p.x * s, y: p.y * s });
  return {
    topLeftCorner: f(c.topLeftCorner),
    topRightCorner: f(c.topRightCorner),
    bottomRightCorner: f(c.bottomRightCorner),
    bottomLeftCorner: f(c.bottomLeftCorner),
  };
}

export async function warpImage(
  sourceUrl: string,
  corners: CornerPoints,
  aspect: PaperAspect,
  scanIntensity: number = DEFAULT_SCAN_INTENSITY,
  scanMode: ScanMode = DEFAULT_SCAN_MODE,
) {
  await ensureOpenCv();
  const cv: Cv = window.cv;
  const image = await loadImageFromUrl(sourceUrl);
  const { canvas: source, scale } = sourceCanvas(image);
  const c = scaleCorners(corners, scale);
  const size = outputSizeForAspect(aspect, c, source.width, source.height);

  const rgba = cv.imread(source);
  const rgb = new cv.Mat();
  cv.cvtColor(rgba, rgb, cv.COLOR_RGBA2RGB);
  rgba.delete();
  let warped: Mat = null;
  let result: Mat = null;
  const canvas = document.createElement('canvas');
  try {
    warped = warpMat(cv, rgb, c, size);
    result = enhance(cv, warped, scanMode, scanIntensity);
    cv.imshow(canvas, result);
  } catch (reason) {
    throw new Error(
      `문서 보정에 실패했습니다: ${reason instanceof Error ? reason.message : String(reason)}`,
    );
  } finally {
    rgb.delete();
    warped?.delete();
    result?.delete();
  }

  // 흑백은 PNG가 작고 선명하다. 컬러·회색조는 JPEG(PNG면 페이지당 10MB 이상)
  const type = scanMode === 'bw' ? 'image/png' : 'image/jpeg';
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (value) =>
        value
          ? resolve(value)
          : reject(new Error('보정 이미지를 만들지 못했습니다.')),
      type,
      0.92,
    );
  });
  return {
    blob,
    width: canvas.width,
    height: canvas.height,
    url: URL.createObjectURL(blob),
  };
}
