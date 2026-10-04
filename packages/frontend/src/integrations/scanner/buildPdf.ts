import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import type { OcrResult } from './types';

export interface PdfPageInput {
  imageBytes: ArrayBuffer;
  width: number;
  height: number;
  ocr?: OcrResult | null;
}

async function loadCjkFont(pdf: PDFDocument) {
  pdf.registerFontkit(fontkit);
  const response = await fetch(
    '/viewer-assets/cad-resources/fonts/NotoSansKR-VF.ttf',
  );
  if (!response.ok) {
    throw new Error('PDF용 한글 글꼴을 불러오지 못했습니다.');
  }
  const bytes = await response.arrayBuffer();
  return pdf.embedFont(bytes, { subset: true });
}

/** 스캔 페이지의 긴 변을 A4 긴 변(297mm = 841.89pt)으로 맞춘다 — 픽셀 수를 그대로 pt로 쓰면 종이가 수십 cm가 된다 */
const PAGE_LONG_PT = 841.89;

const isJpeg = (bytes: ArrayBuffer) => {
  const b = new Uint8Array(bytes, 0, 2);
  return b[0] === 0xff && b[1] === 0xd8;
};

export async function buildSearchablePdf(pages: PdfPageInput[]) {
  if (!pages.length) {
    throw new Error('PDF로 내보낼 페이지가 없습니다.');
  }

  const pdf = await PDFDocument.create();
  let cjkFont = null as Awaited<ReturnType<typeof loadCjkFont>> | null;
  let latinFont = await pdf.embedFont(StandardFonts.Helvetica);

  const needsCjk = pages.some((page) =>
    page.ocr?.words.some((word) => /[^\u0000-\u007f]/.test(word.text)),
  );
  if (needsCjk || pages.some((page) => page.ocr?.text)) {
    try {
      cjkFont = await loadCjkFont(pdf);
    } catch {
      cjkFont = null;
    }
  }

  for (const page of pages) {
    const image = isJpeg(page.imageBytes)
      ? await pdf.embedJpg(page.imageBytes)
      : await pdf.embedPng(page.imageBytes);
    const k = PAGE_LONG_PT / Math.max(page.width, page.height);
    const pageWidth = page.width * k;
    const pageHeight = page.height * k;
    const pdfPage = pdf.addPage([pageWidth, pageHeight]);
    pdfPage.drawImage(image, {
      x: 0,
      y: 0,
      width: pageWidth,
      height: pageHeight,
    });

    const font = cjkFont ?? latinFont;
    if (page.ocr?.words.length) {
      for (const word of page.ocr.words) {
        const text = word.text.trim();
        if (!text) continue;
        if (!cjkFont && /[^\u0000-\u007f]/.test(text)) continue;
        // OCR 좌표는 스캔 이미지 픽셀 기준 → pt로 환산
        const boxWidth = Math.max(1, (word.bbox.x1 - word.bbox.x0) * k);
        const boxHeight = Math.max(1, (word.bbox.y1 - word.bbox.y0) * k);
        const fontSize = Math.max(2, Math.min(boxHeight * 0.9, boxWidth));
        const x = word.bbox.x0 * k;
        const y = pageHeight - word.bbox.y1 * k;
        try {
          pdfPage.drawText(text, {
            x,
            y,
            size: fontSize,
            font,
            color: rgb(0, 0, 0),
            opacity: 0,
            maxWidth: boxWidth,
          });
        } catch {
          // Skip glyphs the embedded font cannot encode.
        }
      }
    }
  }

  return pdf.save();
}
