import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';

const WORKER_SRC = '/viewer-assets/scanner/pdfjs/pdf.worker.min.mjs';
const MAX_SIDE = 1800;

let workerConfigured = false;

function ensureWorker() {
  if (workerConfigured) return;
  GlobalWorkerOptions.workerSrc = WORKER_SRC;
  workerConfigured = true;
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('PDF 페이지를 PNG로 변환하지 못했습니다.'));
          return;
        }
        resolve(blob);
      },
      'image/png',
    );
  });
}

export interface PdfRenderedPage {
  name: string;
  blob: Blob;
  width: number;
  height: number;
}

export async function renderPdfToImages(
  file: File,
  onProgress?: (done: number, total: number) => void,
): Promise<PdfRenderedPage[]> {
  ensureWorker();
  const data = await file.arrayBuffer();
  const pdf = await getDocument({ data }).promise;
  const base = file.name.replace(/\.pdf$/i, '') || 'document';
  const pages: PdfRenderedPage[] = [];

  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      onProgress?.(pageNumber - 1, pdf.numPages);
      const page = await pdf.getPage(pageNumber);
      const unscaled = page.getViewport({ scale: 1 });
      const longest = Math.max(unscaled.width, unscaled.height);
      const scale = longest > 0 ? Math.min(2.5, MAX_SIDE / longest) : 1;
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.floor(viewport.width));
      canvas.height = Math.max(1, Math.floor(viewport.height));
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) {
        throw new Error('PDF 렌더용 Canvas를 만들지 못했습니다.');
      }
      await page.render({ canvasContext: context, viewport, canvas }).promise;
      const blob = await canvasToPngBlob(canvas);
      pages.push({
        name: `${base}-p${pageNumber}.png`,
        blob,
        width: canvas.width,
        height: canvas.height,
      });
      page.cleanup();
    }
    onProgress?.(pdf.numPages, pdf.numPages);
  } finally {
    await pdf.cleanup();
  }

  return pages;
}

export function isPdfFile(file: File): boolean {
  return (
    file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
  );
}

export function isScannerImageFile(file: File): boolean {
  return (
    /^image\/(png|jpe?g|webp|gif|bmp)$/i.test(file.type) ||
    /\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name)
  );
}
