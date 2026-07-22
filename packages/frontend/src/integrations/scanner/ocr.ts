import * as ort from 'onnxruntime-web';
import ortWasmUrl from 'onnxruntime-web/ort-wasm-simd-threaded.jsep.wasm?url';
import ortMjsUrl from 'onnxruntime-web/ort-wasm-simd-threaded.jsep.mjs?url';
import {
  PaddleOcrService,
  V5_KOREAN_MOBILE_MODEL,
} from 'ppu-paddle-ocr/web';
import type { OcrResult, OcrWord } from './types';

const PADDLE_BASE = '/viewer-assets/scanner/paddle';

let servicePromise: Promise<PaddleOcrService> | null = null;

async function toCanvas(
  source: string | Blob | HTMLCanvasElement,
): Promise<HTMLCanvasElement> {
  if (source instanceof HTMLCanvasElement) return source;

  const objectUrl =
    typeof source === 'string' ? null : URL.createObjectURL(source);
  const src = typeof source === 'string' ? source : objectUrl!;
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () =>
        reject(new Error('OCR용 이미지를 불러오지 못했습니다.'));
      image.src = src;
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Canvas를 초기화하지 못했습니다.');
    ctx.drawImage(img, 0, 0);
    return canvas;
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

async function getService(
  onProgress?: (value: number, label: string) => void,
): Promise<PaddleOcrService> {
  if (!servicePromise) {
    servicePromise = (async () => {
      onProgress?.(0.05, 'OCR 모델 준비 중');
      // Vite는 /public .mjs 를 import() 하면 실패하므로 node_modules 에셋 URL 사용
      ort.env.wasm.numThreads = 1;
      ort.env.wasm.wasmPaths = {
        wasm: ortWasmUrl,
        mjs: ortMjsUrl,
      };
      const service = new PaddleOcrService({
        model: {
          ...V5_KOREAN_MOBILE_MODEL,
          detection: `${PADDLE_BASE}/PP-OCRv5_mobile_det_infer.onnx`,
          recognition: `${PADDLE_BASE}/korean_PP-OCRv5_mobile_rec_infer.onnx`,
          charactersDictionary: `${PADDLE_BASE}/ppocrv5_korean_dict.txt`,
        },
        processing: { engine: 'canvas-native' },
        debugging: { verbose: false, debug: false },
      });
      await service.initialize();
      onProgress?.(0.35, 'OCR 모델 준비 완료');
      return service;
    })().catch((error) => {
      servicePromise = null;
      throw error;
    });
  }
  return servicePromise;
}

export async function recognizeImage(
  source: string | Blob | HTMLCanvasElement,
  onProgress?: (value: number, label: string) => void,
): Promise<OcrResult> {
  const service = await getService(onProgress);
  onProgress?.(0.4, '문자 인식 중');
  const canvas = await toCanvas(source);
  const result = await service.recognize(canvas, {
    flatten: true,
    strategy: 'per-box',
  });
  const words: OcrWord[] = result.results
    .filter((item) => item.text?.trim())
    .map((item) => ({
      text: item.text,
      confidence: Math.round((item.confidence ?? 0) * 100),
      bbox: {
        x0: item.box.x,
        y0: item.box.y,
        x1: item.box.x + item.box.width,
        y1: item.box.y + item.box.height,
      },
    }));
  onProgress?.(1, 'OCR 완료');
  return {
    text: result.text?.trim() ?? words.map((word) => word.text).join(' '),
    words,
  };
}

export async function terminateOcrWorker() {
  if (!servicePromise) return;
  const service = await servicePromise;
  servicePromise = null;
  await service.destroy();
}
