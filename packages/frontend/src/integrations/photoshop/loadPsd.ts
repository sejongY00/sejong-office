import { readPsd, type Psd } from 'ag-psd';

export const PSD_INCOMPATIBLE_MESSAGE =
  '이 브라우저에서는 RGB·Grayscale·Bitmap / 8bit .psd만 안정적으로 볼 수 있습니다. CMYK·16bit·PSB는 지원하지 않습니다.';

export type OpenedPsd = {
  width: number;
  height: number;
  /** Composite image produced by ag-psd */
  canvas: HTMLCanvasElement;
};

export function isPsdFile(file: File): boolean {
  return (
    /\.psd$/i.test(file.name) || file.type === 'image/vnd.adobe.photoshop'
  );
}

export function openPsd(data: ArrayBuffer): OpenedPsd {
  let psd: Psd;
  try {
    psd = readPsd(data);
  } catch {
    throw new Error(PSD_INCOMPATIBLE_MESSAGE);
  }

  const source = psd.canvas;
  if (!source || source.width < 1 || source.height < 1) {
    throw new Error(PSD_INCOMPATIBLE_MESSAGE);
  }

  return {
    width: psd.width || source.width,
    height: psd.height || source.height,
    canvas: source as HTMLCanvasElement,
  };
}

export function drawPsdToCanvas(
  source: HTMLCanvasElement,
  target: HTMLCanvasElement,
  scale: number,
): { width: number; height: number } {
  const width = Math.max(1, Math.floor(source.width * scale));
  const height = Math.max(1, Math.floor(source.height * scale));
  target.width = width;
  target.height = height;
  const context = target.getContext('2d', { alpha: true });
  if (!context) {
    throw new Error('캔버스를 초기화하지 못했습니다.');
  }
  context.clearRect(0, 0, width, height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(source, 0, 0, width, height);
  return { width, height };
}
