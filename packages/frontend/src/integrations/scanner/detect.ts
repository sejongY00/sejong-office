import type { CornerPoints, Point2D } from './types';

declare global {
  interface Window {
    cv?: {
      Mat: new () => unknown;
      imread: (el: HTMLCanvasElement | HTMLImageElement) => {
        delete: () => void;
        cols: number;
        rows: number;
      };
      onRuntimeInitialized?: () => void;
    };
    jscanify?: new () => JscanifyInstance;
  }
}

export interface JscanifyInstance {
  findPaperContour: (mat: unknown) => unknown | null;
  getCornerPoints: (contour: unknown) => Partial<CornerPoints>;
  extractPaper: (
    image: HTMLCanvasElement | HTMLImageElement,
    width: number,
    height: number,
    corners?: CornerPoints,
  ) => HTMLCanvasElement | null;
}

const OPENCV_URL = '/viewer-assets/scanner/opencv.js';
const JSCANIFY_URL = '/viewer-assets/scanner/jscanify.js';

let opencvReady: Promise<void> | null = null;
let jscanifyReady: Promise<void> | null = null;

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[data-scanner-src="${src}"]`,
    );
    if (existing) {
      if (existing.dataset.loaded === '1') {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener(
        'error',
        () => reject(new Error(`스크립트를 불러오지 못했습니다: ${src}`)),
        { once: true },
      );
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.dataset.scannerSrc = src;
    script.onload = () => {
      script.dataset.loaded = '1';
      resolve();
    };
    script.onerror = () =>
      reject(new Error(`스크립트를 불러오지 못했습니다: ${src}`));
    document.head.appendChild(script);
  });
}

export async function ensureOpenCv() {
  if (typeof window.cv?.Mat === 'function') return;
  if (!opencvReady) {
    opencvReady = (async () => {
      await loadScript(OPENCV_URL);
      const cv = window.cv;
      if (!cv) throw new Error('OpenCV.js를 초기화하지 못했습니다.');
      if (typeof cv.Mat === 'function') return;
      await new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(() => {
          reject(new Error('OpenCV.js 초기화 시간이 초과되었습니다.'));
        }, 60_000);
        const finish = () => {
          window.clearTimeout(timeout);
          window.clearInterval(poll);
          resolve();
        };
        const previous = cv.onRuntimeInitialized;
        cv.onRuntimeInitialized = () => {
          previous?.();
          finish();
        };
        const poll = window.setInterval(() => {
          if (typeof cv.Mat === 'function') finish();
        }, 50);
      });
    })().catch((error) => {
      opencvReady = null;
      throw error;
    });
  }
  await opencvReady;
}

export async function ensureJscanify() {
  await ensureOpenCv();
  if (window.jscanify) return;
  if (!jscanifyReady) {
    jscanifyReady = loadScript(JSCANIFY_URL);
  }
  await jscanifyReady;
  if (!window.jscanify) {
    throw new Error('jscanify를 불러오지 못했습니다.');
  }
}

export function createScanner() {
  if (!window.jscanify) {
    throw new Error('jscanify가 준비되지 않았습니다.');
  }
  return new window.jscanify();
}

export function fullFrameCorners(
  width: number,
  height: number,
): CornerPoints {
  return {
    topLeftCorner: { x: 0, y: 0 },
    topRightCorner: { x: width, y: 0 },
    bottomRightCorner: { x: width, y: height },
    bottomLeftCorner: { x: 0, y: height },
  };
}

function isValidPoint(point: Point2D | undefined): point is Point2D {
  return (
    !!point &&
    Number.isFinite(point.x) &&
    Number.isFinite(point.y)
  );
}

export function normalizeCorners(
  corners: Partial<CornerPoints> | null | undefined,
  width: number,
  height: number,
): CornerPoints {
  const fallback = fullFrameCorners(width, height);
  if (!corners) return fallback;
  const next: CornerPoints = {
    topLeftCorner: isValidPoint(corners.topLeftCorner)
      ? corners.topLeftCorner
      : fallback.topLeftCorner,
    topRightCorner: isValidPoint(corners.topRightCorner)
      ? corners.topRightCorner
      : fallback.topRightCorner,
    bottomRightCorner: isValidPoint(corners.bottomRightCorner)
      ? corners.bottomRightCorner
      : fallback.bottomRightCorner,
    bottomLeftCorner: isValidPoint(corners.bottomLeftCorner)
      ? corners.bottomLeftCorner
      : fallback.bottomLeftCorner,
  };
  return next;
}

export function detectCornersFromImage(
  image: HTMLImageElement | HTMLCanvasElement,
): CornerPoints {
  const scanner = createScanner();
  const cv = window.cv!;
  const mat = cv.imread(image);
  try {
    const contour = scanner.findPaperContour(mat);
    if (!contour) {
      return fullFrameCorners(image.width, image.height);
    }
    const corners = scanner.getCornerPoints(contour);
    if (
      typeof (contour as { delete?: () => void }).delete === 'function'
    ) {
      (contour as { delete: () => void }).delete();
    }
    return normalizeCorners(corners, image.width, image.height);
  } finally {
    mat.delete();
  }
}

export function loadImageFromUrl(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('이미지를 불러오지 못했습니다.'));
    image.src = url;
  });
}
