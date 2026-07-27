import {
  GlobalWorkerOptions,
  getDocument,
  RenderingCancelledException,
  type PDFDocumentProxy,
  type RenderTask,
} from 'pdfjs-dist';

const WORKER_SRC = '/viewer-assets/scanner/pdfjs/pdf.worker.min.mjs';

let workerConfigured = false;
let activeRender: RenderTask | null = null;
/** Serialize canvas renders so pdf.js never sees overlapping render() calls. */
let renderGate: Promise<void> = Promise.resolve();

function ensureWorker() {
  if (workerConfigured) return;
  GlobalWorkerOptions.workerSrc = WORKER_SRC;
  workerConfigured = true;
}

/** PDF-compatible .ai embeds a PDF stream (often starts with %PDF). */
export function looksPdfCompatibleAi(data: ArrayBuffer): boolean {
  const n = Math.min(data.byteLength, 8192);
  if (n < 5) return false;
  const text = new TextDecoder('latin1').decode(data.slice(0, n));
  return text.includes('%PDF');
}

export const AI_INCOMPATIBLE_MESSAGE =
  'PDF 호환으로 저장된 .ai만 열 수 있습니다. Illustrator에서 「PDF 호환 파일 만들기」로 저장한 뒤 다시 열어 주세요.';

export function isAiRenderCancelled(reason: unknown): boolean {
  return (
    reason instanceof RenderingCancelledException ||
    (typeof reason === 'object' &&
      reason !== null &&
      'name' in reason &&
      (reason as { name: string }).name === 'RenderingCancelledException')
  );
}

export async function cancelAiRender(): Promise<void> {
  const task = activeRender;
  if (!task) return;
  activeRender = null;
  task.cancel();
  try {
    await task.promise;
  } catch {
    /* cancelled or failed after cancel */
  }
}

export async function openAiAsPdf(data: ArrayBuffer): Promise<PDFDocumentProxy> {
  ensureWorker();
  if (!looksPdfCompatibleAi(data)) {
    throw new Error(AI_INCOMPATIBLE_MESSAGE);
  }
  try {
    return await getDocument({ data: data.slice(0) }).promise;
  } catch {
    throw new Error(AI_INCOMPATIBLE_MESSAGE);
  }
}

export async function renderAiPage(
  pdf: PDFDocumentProxy,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  scale: number,
): Promise<{ width: number; height: number }> {
  // Interrupt in-flight work so the gate holder can exit quickly.
  void cancelAiRender();

  let release!: () => void;
  const previous = renderGate;
  renderGate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;

  try {
    await cancelAiRender();

    const page = await pdf.getPage(pageNumber);
    try {
      const viewport = page.getViewport({ scale });
      canvas.width = Math.max(1, Math.floor(viewport.width));
      canvas.height = Math.max(1, Math.floor(viewport.height));
      const context = canvas.getContext('2d', { alpha: false });
      if (!context) {
        throw new Error('캔버스를 초기화하지 못했습니다.');
      }
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);

      const task = page.render({ canvasContext: context, viewport, canvas });
      activeRender = task;
      try {
        await task.promise;
      } finally {
        if (activeRender === task) activeRender = null;
      }

      return { width: canvas.width, height: canvas.height };
    } finally {
      page.cleanup();
    }
  } finally {
    release();
  }
}

export function isAiFile(file: File): boolean {
  return /\.ai$/i.test(file.name) || file.type === 'application/postscript';
}
