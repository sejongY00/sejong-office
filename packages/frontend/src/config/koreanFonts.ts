/**
 * Open-source Korean fonts (SIL OFL 1.1) embedded for offline Office/HWP/Diagram rendering
 * and automatic alias mapping for common proprietary Korean document font names.
 */

export interface EmbeddedKoreanFontFamily {
  /** Primary Korean display name */
  readonly name: string;
  /** English family name inside the TTF */
  readonly englishName: string;
  /** Proprietary or alternate font names automatically routed to this font */
  readonly aliases: readonly string[];
  readonly regularFile: string;
  readonly boldFile: string;
}

export const EMBEDDED_KOREAN_FONT_FAMILIES: readonly EmbeddedKoreanFontFamily[] = [
  {
    name: '나눔고딕',
    englishName: 'NanumGothic',
    aliases: [
      'Nanum Gothic',
      '맑은 고딕',
      'Malgun Gothic',
      '굴림',
      '굴림체',
      'Gulim',
      'GulimChe',
      '새굴림',
    ],
    regularFile: '/fonts/NanumGothic-Regular.ttf',
    boldFile: '/fonts/NanumGothic-Bold.ttf',
  },
  {
    name: '나눔바른고딕',
    englishName: 'NanumBarunGothic',
    aliases: [
      'Nanum Barun Gothic',
      '돋움',
      '돋움체',
      'Dotum',
      'DotumChe',
      '함초롬돋움',
      'HCR Dotum',
      '한컴돋움',
    ],
    regularFile: '/fonts/NanumBarunGothic-Regular.ttf',
    boldFile: '/fonts/NanumBarunGothic-Bold.ttf',
  },
  {
    name: '나눔스퀘어',
    englishName: 'NanumSquare',
    aliases: ['Nanum Square', 'NanumSquare Bold', '나눔스퀘어 Bold'],
    regularFile: '/fonts/NanumSquare-Regular.ttf',
    boldFile: '/fonts/NanumSquare-Bold.ttf',
  },
  {
    name: '나눔명조',
    englishName: 'NanumMyeongjo',
    aliases: [
      'Nanum Myeongjo',
      '바탕',
      '바탕체',
      'Batang',
      'BatangChe',
      '함초롬바탕',
      'HCR Batang',
      '한컴바탕',
      '신명조',
      '휴먼명조',
      'HY신명조',
      '궁서',
      '궁서체',
      'Gungsuh',
      'GungsuhChe',
    ],
    regularFile: '/fonts/NanumMyeongjo-Regular.ttf',
    boldFile: '/fonts/NanumMyeongjo-Regular.ttf',
  },
];

export function buildKoreanFontFaceCss(baseOrigin = ''): string {
  const prefix = baseOrigin.replace(/\/+$/, '');
  const rules: string[] = [];

  for (const group of EMBEDDED_KOREAN_FONT_FAMILIES) {
    const allNames = [group.name, group.englishName, ...group.aliases];
    const regUrl = `${prefix}${group.regularFile}`;
    const boldUrl = `${prefix}${group.boldFile}`;

    for (const familyName of allNames) {
      const escaped = familyName.replace(/"/g, '\\"');
      rules.push(
        `@font-face { font-family: "${escaped}"; src: local("${escaped}"), url("${regUrl}") format("truetype"); font-weight: 400; font-style: normal; font-display: swap; }`,
        `@font-face { font-family: "${escaped}"; src: local("${escaped} Bold"), local("${escaped}"), url("${boldUrl}") format("truetype"); font-weight: 700; font-style: normal; font-display: swap; }`,
      );
    }
  }

  return rules.join('\n');
}

export function installEmbeddedKoreanFontFaces(doc: Document = document, baseOrigin = ''): void {
  const styleId = 'sejong-embedded-korean-fonts';
  if (doc.getElementById(styleId)) return;
  const style = doc.createElement('style');
  style.id = styleId;
  style.textContent = buildKoreanFontFaceCss(baseOrigin);
  (doc.head || doc.documentElement)?.appendChild(style);
}
