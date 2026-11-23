import { describe, expect, it } from 'vitest';
import {
  buildKoreanFontFaceCss,
  EMBEDDED_KOREAN_FONT_FAMILIES,
} from './koreanFonts';

describe('koreanFonts', () => {
  it('includes 나눔고딕 (1), 나눔바른고딕 (2), 나눔스퀘어 (3), and 나눔명조 with automatic aliases', () => {
    const names = EMBEDDED_KOREAN_FONT_FAMILIES.map((f) => f.name);
    expect(names).toEqual(['나눔고딕', '나눔바른고딕', '나눔스퀘어', '나눔명조']);

    const css = buildKoreanFontFaceCss();
    for (const requiredFamily of [
      '나눔고딕',
      '나눔바른고딕',
      '나눔스퀘어',
      '나눔명조',
      '맑은 고딕',
      'Malgun Gothic',
      '바탕',
      '바탕체',
      '돋움',
      '돋움체',
      '굴림',
      '굴림체',
      '궁서',
      '궁서체',
      '함초롬바탕',
      '함초롬돋움',
    ]) {
      expect(css).toContain(`font-family: "${requiredFamily}"`);
    }
  });
});
