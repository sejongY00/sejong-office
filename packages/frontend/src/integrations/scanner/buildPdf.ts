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
    const image = await pdf.embedPng(page.imageBytes);
    const pdfPage = pdf.addPage([page.width, page.height]);
    pdfPage.drawImage(image, {
      x: 0,
      y: 0,
      width: page.width,
      height: page.height,
    });

    const font = cjkFont ?? latinFont;
    if (page.ocr?.words.length) {
      for (const word of page.ocr.words) {
        const text = word.text.trim();
        if (!text) continue;
        if (!cjkFont && /[^\u0000-\u007f]/.test(text)) continue;
        const boxWidth = Math.max(1, word.bbox.x1 - word.bbox.x0);
        const boxHeight = Math.max(1, word.bbox.y1 - word.bbox.y0);
        const fontSize = Math.max(4, Math.min(boxHeight * 0.9, boxWidth));
        const x = word.bbox.x0;
        const y = page.height - word.bbox.y1;
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
