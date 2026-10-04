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

/** 원본: 원근 보정만 · 컬러/회색조 문서: 조명 평탄화·글자 보정 · 흑백 문서: 이진화 */
export type ScanMode = 'original' | 'color' | 'gray' | 'bw';

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
  scanMode: ScanMode;
  /** 글자 진하기·선명도 0–100 (흑백은 이진화 문턱) */
  scanIntensity: number;
  warpedUrl: string | null;
  warpedWidth: number;
  warpedHeight: number;
  ocr: OcrResult | null;
}
