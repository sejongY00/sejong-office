export interface Point2D {
  x: number;
  y: number;
}

export interface CornerPoints {
  topLeftCorner: Point2D;
  topRightCorner: Point2D;
  bottomLeftCorner: Point2D;
  bottomRightCorner: Point2D;
}

export type PaperAspect = 'a4-portrait' | 'a4-landscape' | 'square' | 'auto';

export interface OcrWord {
  text: string;
  /** Pixel bbox on the warped image: x0,y0,x1,y1 */
  bbox: { x0: number; y0: number; x1: number; y1: number };
  confidence: number;
}

export interface OcrResult {
  text: string;
  words: OcrWord[];
}

export interface ScannerPage {
  id: string;
  name: string;
  sourceUrl: string;
  sourceWidth: number;
  sourceHeight: number;
  corners: CornerPoints;
  aspect: PaperAspect;
  /** 0 = 원본 색감, 100 = 강한 문서 스캔 보정 */
  scanIntensity: number;
  warpedUrl: string | null;
  warpedWidth: number;
  warpedHeight: number;
  ocr: OcrResult | null;
}
