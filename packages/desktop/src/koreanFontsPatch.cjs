/**
 * Patches OnlyOffice's `AllFonts.js` and `fonts_thumbnail*.png.bin` sprites so that:
 * 1. Korean open-source fonts 1 (나눔고딕), 2 (나눔바른고딕), 3 (나눔스퀘어), and 나눔명조
 *    are selectable by their Korean and English names with full Regular + Bold support.
 * 2. Common proprietary Korean font names found in existing documents (`맑은 고딕`, `바탕`,
 *    `바탕체`, `돋움`, `돋움체`, `굴림`, `굴림체`, `궁서`, `궁서체`, `함초롬바탕`, `함초롬돋움`, etc.)
 *    automatically resolve to those embedded SIL OFL 1.1 Korean fonts.
 */

const KOREAN_FONT_ALIASES = [
  // 1. 나눔고딕 (slot 183 Regular, 184 Bold)
  { name: '나눔고딕', target: 'NanumGothic', reg: 183, bold: 184 },
  { name: 'Nanum Gothic', target: 'NanumGothic', reg: 183, bold: 184 },

  // 2. 나눔바른고딕 (slot 181 Regular, 182 Bold)
  { name: '나눔바른고딕', target: 'NanumBarunGothic', reg: 181, bold: 182 },
  { name: 'Nanum Barun Gothic', target: 'NanumBarunGothic', reg: 181, bold: 182 },

  // 3. 나눔스퀘어 (slot 187 Regular, 186 Bold)
  { name: '나눔스퀘어', target: 'NanumSquare', reg: 187, bold: 186 },
  { name: 'Nanum Square', target: 'NanumSquare', reg: 187, bold: 186 },

  // 나눔명조 (slot 185 Regular; leave bold = -1 so OnlyOffice synthesizes bold cleanly)
  { name: '나눔명조', target: 'NanumMyeongjo', reg: 185, bold: -1 },
  { name: 'Nanum Myeongjo', target: 'NanumMyeongjo', reg: 185, bold: -1 },

  // Automatic fallback mappings for standard Korean document fonts
  { name: '맑은 고딕', target: 'NanumGothic', reg: 183, bold: 184 },
  { name: 'Malgun Gothic', target: 'NanumGothic', reg: 183, bold: 184 },
  { name: 'Pretendard', target: 'NanumGothic', reg: 183, bold: 184 },
  { name: 'Apple SD Gothic Neo', target: 'NanumGothic', reg: 183, bold: 184 },
  { name: 'AppleGothic', target: 'NanumGothic', reg: 183, bold: 184 },
  { name: 'Noto Sans KR', target: 'NanumGothic', reg: 183, bold: 184 },
  { name: '굴림', target: 'NanumGothic', reg: 183, bold: 184 },
  { name: '굴림체', target: 'NanumGothic', reg: 183, bold: 184 },
  { name: 'Gulim', target: 'NanumGothic', reg: 183, bold: 184 },
  { name: 'GulimChe', target: 'NanumGothic', reg: 183, bold: 184 },
  { name: '새굴림', target: 'NanumGothic', reg: 183, bold: 184 },

  { name: '돋움', target: 'NanumBarunGothic', reg: 181, bold: 182 },
  { name: '돋움체', target: 'NanumBarunGothic', reg: 181, bold: 182 },
  { name: 'Dotum', target: 'NanumBarunGothic', reg: 181, bold: 182 },
  { name: 'DotumChe', target: 'NanumBarunGothic', reg: 181, bold: 182 },
  { name: '함초롬돋움', target: 'NanumBarunGothic', reg: 181, bold: 182 },
  { name: 'HCR Dotum', target: 'NanumBarunGothic', reg: 181, bold: 182 },
  { name: '한컴돋움', target: 'NanumBarunGothic', reg: 181, bold: 182 },

  { name: '바탕', target: 'NanumMyeongjo', reg: 185, bold: -1 },
  { name: '바탕체', target: 'NanumMyeongjo', reg: 185, bold: -1 },
  { name: 'Batang', target: 'NanumMyeongjo', reg: 185, bold: -1 },
  { name: 'BatangChe', target: 'NanumMyeongjo', reg: 185, bold: -1 },
  { name: '함초롬바탕', target: 'NanumMyeongjo', reg: 185, bold: -1 },
  { name: 'HCR Batang', target: 'NanumMyeongjo', reg: 185, bold: -1 },
  { name: '한컴바탕', target: 'NanumMyeongjo', reg: 185, bold: -1 },
  { name: '신명조', target: 'NanumMyeongjo', reg: 185, bold: -1 },
  { name: '휴먼명조', target: 'NanumMyeongjo', reg: 185, bold: -1 },
  { name: 'HY신명조', target: 'NanumMyeongjo', reg: 185, bold: -1 },
  { name: '궁서', target: 'NanumMyeongjo', reg: 185, bold: -1 },
  { name: '궁서체', target: 'NanumMyeongjo', reg: 185, bold: -1 },
  { name: 'Gungsuh', target: 'NanumMyeongjo', reg: 185, bold: -1 },
  { name: 'GungsuhChe', target: 'NanumMyeongjo', reg: 185, bold: -1 },
];

/**
 * Office Latin font aliases wired to metric-compatible bundled open-source fonts with full
 * Regular / Italic / Bold / BoldItalic coverage (fixes unbolded digits/ASCII in Calibri/Word DOCX).
 */
const LATIN_FONT_ALIASES = [
  // Calibri & modern Word sans-serif defaults -> Carlito (indices 115, 114, 112, 113 -> files 112, 111, 109, 110)
  { name: 'Calibri', target: 'Carlito', reg: 115, ital: 114, bold: 112, boldItal: 113 },
  { name: 'Calibri Light', target: 'Carlito', reg: 115, ital: 114, bold: 112, boldItal: 113 },
  { name: 'Aptos', target: 'Carlito', reg: 115, ital: 114, bold: 112, boldItal: 113 },
  { name: 'Segoe UI', target: 'Carlito', reg: 115, ital: 114, bold: 112, boldItal: 113 },
  // Cambria -> Caladea (indices 111, 110, 108, 109 -> files 108, 107, 105, 106)
  { name: 'Cambria', target: 'Caladea', reg: 111, ital: 110, bold: 108, boldItal: 109 },
  // Consolas -> Liberation Mono (indices 61, 60, 58, 59 -> files 058, 057, 055, 056)
  { name: 'Consolas', target: 'Liberation Mono', reg: 61, ital: 60, bold: 58, boldItal: 59 },
];

/** Slots in OnlyOffice's font catalog that back the Korean fonts above. */
const KOREAN_CATALOG_SLOTS = ['181', '182', '183', '184', '185', '186', '187'];

function decodeSelectionBin(base64) {
  const buf = Buffer.from(base64, 'base64');
  let p = 0;
  const int32 = () => {
    const v = buf.readInt32LE(p);
    p += 4;
    return v;
  };
  const uint32 = () => {
    const v = buf.readUInt32LE(p);
    p += 4;
    return v;
  };
  const uint16 = () => {
    const v = buf.readUInt16LE(p);
    p += 2;
    return v;
  };
  const str = () => {
    const n = int32();
    const s = buf.toString('utf8', p, p + n);
    p += n;
    return s;
  };
  const count = int32();
  const records = [];
  for (let i = 0; i < count; i += 1) {
    const start = p;
    const size = int32();
    const name = str();
    const altNames = [];
    for (let k = int32(); k > 0; k -= 1) altNames.push(str());
    const record = {
      name,
      altNames,
      path: str(),
      index: int32(),
      italic: int32(),
      bold: int32(),
      fixed: int32(),
    };
    record.panose = Array.from({ length: int32() }, () => buf[p++]);
    record.unicodeRange = [uint32(), uint32(), uint32(), uint32()];
    record.codePageRange = [uint32(), uint32()];
    record.weight = uint16();
    record.width = uint16();
    record.familyClass = uint16();
    record.format = uint16();
    record.avgCharWidth = uint16();
    record.ascent = uint16();
    record.descent = uint16();
    record.lineGap = uint16();
    record.xHeight = uint16();
    record.capHeight = uint16();
    record.type = uint16();
    record.trailing = buf.subarray(p, start + size);
    p = start + size;
    records.push(record);
  }
  return { records, tail: buf.subarray(p) };
}

function encodeSelectionBin({ records, tail = Buffer.alloc(0) }) {
  const header = Buffer.alloc(4);
  header.writeInt32LE(records.length, 0);
  const parts = [header];
  for (const r of records) {
    const chunks = [];
    const int32 = (v) => {
      const b = Buffer.alloc(4);
      b.writeInt32LE(v, 0);
      chunks.push(b);
    };
    const uint32 = (v) => {
      const b = Buffer.alloc(4);
      b.writeUInt32LE(v >>> 0, 0);
      chunks.push(b);
    };
    const uint16 = (v) => {
      const b = Buffer.alloc(2);
      b.writeUInt16LE(v & 0xffff, 0);
      chunks.push(b);
    };
    const str = (s) => {
      const b = Buffer.from(s, 'utf8');
      int32(b.length);
      chunks.push(b);
    };
    str(r.name);
    int32(r.altNames.length);
    for (const alt of r.altNames) str(alt);
    str(r.path);
    int32(r.index);
    int32(r.italic);
    int32(r.bold);
    int32(r.fixed);
    int32(r.panose.length);
    chunks.push(Buffer.from(r.panose));
    for (const v of r.unicodeRange) uint32(v);
    for (const v of r.codePageRange) uint32(v);
    for (const v of [
      r.weight,
      r.width,
      r.familyClass,
      r.format,
      r.avgCharWidth,
      r.ascent,
      r.descent,
      r.lineGap,
      r.xHeight,
      r.capHeight,
      r.type,
    ]) {
      uint16(v);
    }
    if (r.trailing?.length) chunks.push(Buffer.from(r.trailing));
    const body = Buffer.concat(chunks);
    const size = Buffer.alloc(4);
    size.writeInt32LE(body.length + 4, 0);
    parts.push(size, body);
  }
  parts.push(Buffer.from(tail));
  return Buffer.concat(parts).toString('base64');
}

function patchAllFontsSource(source) {
  if (typeof source !== 'string' || source.includes('__SEJONG_KR_FONTS_PATCHED__')) {
    return source;
  }

  const infosMarker = 'window["__fonts_infos"] = [';
  const infosStart = source.indexOf(infosMarker);
  if (infosStart < 0) return source;
  const infosBodyStart = infosStart + infosMarker.length;
  const infosBodyEnd = source.indexOf('];', infosBodyStart);
  if (infosBodyEnd < 0) return source;

  const selMarker = 'window["g_fonts_selection_bin"] = "';
  const selStart = source.indexOf(selMarker);
  if (selStart < 0) return source;
  const selBodyStart = selStart + selMarker.length;
  const selBodyEnd = source.indexOf('"', selBodyStart);
  if (selBodyEnd < 0) return source;

  const infos = JSON.parse(`[${source.slice(infosBodyStart, infosBodyEnd).replace(/\n/g, '')}]`);
  const existingNames = new Set(infos.map((r) => r[0]));

  const latinAliasByName = new Map(LATIN_FONT_ALIASES.map((entry) => [entry.name, entry]));

  // Wire full Bold/Italic slots for existing rows (Calibri -> Carlito, NanumSquare -> Bold 186, Noto Sans KR -> NanumGothic)
  for (const row of infos) {
    if (row[0] === 'NanumSquare' && row[5] < 0) {
      row[5] = 186;
      row[6] = 0;
    } else if (row[0] === 'Noto Sans KR') {
      row[1] = 183;
      row[2] = 0;
      row[5] = 184;
      row[6] = 0;
    } else if (latinAliasByName.has(row[0])) {
      const alias = latinAliasByName.get(row[0]);
      row[1] = alias.reg;
      row[2] = 0;
      row[3] = alias.ital;
      row[4] = alias.ital >= 0 ? 0 : -1;
      row[5] = alias.bold;
      row[6] = alias.bold >= 0 ? 0 : -1;
      row[7] = alias.boldItal;
      row[8] = alias.boldItal >= 0 ? 0 : -1;
    }
  }

  for (const entry of KOREAN_FONT_ALIASES) {
    if (!existingNames.has(entry.name)) {
      infos.push([
        entry.name,
        entry.reg,
        0,
        -1,
        -1,
        entry.bold,
        entry.bold >= 0 ? 0 : -1,
        -1,
        -1,
      ]);
      existingNames.add(entry.name);
    }
  }

  for (const entry of LATIN_FONT_ALIASES) {
    if (!existingNames.has(entry.name)) {
      infos.push([
        entry.name,
        entry.reg,
        0,
        entry.ital,
        entry.ital >= 0 ? 0 : -1,
        entry.bold,
        entry.bold >= 0 ? 0 : -1,
        entry.boldItal,
        entry.boldItal >= 0 ? 0 : -1,
      ]);
      existingNames.add(entry.name);
    }
  }

  // Enrich g_fonts_selection_bin altNames so OnlyOffice CFontSelectFormat matches with 0 penalty
  const parsedSel = decodeSelectionBin(source.slice(selBodyStart, selBodyEnd));
  const aliasesByTarget = new Map();
  for (const entry of [...KOREAN_FONT_ALIASES, ...LATIN_FONT_ALIASES]) {
    const list = aliasesByTarget.get(entry.target) || [];
    list.push(entry.name);
    aliasesByTarget.set(entry.target, list);
  }
  aliasesByTarget.set('NanumSquare Bold', ['나눔스퀘어 Bold']);

  for (const rec of parsedSel.records) {
    // NanumSquareB.ttf ships with bold=0 in upstream selection_bin; mark bold=1 so Regular NanumSquare picks NanumSquareR.ttf
    if (rec.name === 'NanumSquare Bold') {
      rec.bold = 1;
    }
    const extras = aliasesByTarget.get(rec.name);
    if (!extras) continue;
    for (const alias of extras) {
      if (!rec.altNames.includes(alias)) {
        rec.altNames.push(alias);
      }
    }
  }

  const nextSelBase64 = encodeSelectionBin(parsedSel);
  const nextInfosText = `\n${infos.map((r) => JSON.stringify(r)).join(',\n')}\n`;

  let out = source.slice(0, selBodyStart) + nextSelBase64 + source.slice(selBodyEnd);
  out = out.slice(0, infosBodyStart) + nextInfosText + out.slice(infosBodyEnd);
  out += '\nwindow.__SEJONG_KR_FONTS_PATCHED__ = true;\n';
  return out;
}

/**
 * Pad `fonts_thumbnail*.png.bin` sprite buffer so its tile count covers all rows in `__fonts_infos`
 * (preventing RangeError when scrolling the font picker after adding Korean alias rows).
 */
function padFontThumbnailSpriteBin(binBuffer, requiredCount = 280) {
  const buf = Buffer.isBuffer(binBuffer) ? binBuffer : Buffer.from(binBuffer);
  if (buf.byteLength < 12) return buf;
  const width = buf.readUInt32BE(0);
  const heightOne = buf.readUInt32BE(4);
  const count = buf.readUInt32BE(8);
  if (count >= requiredCount || width === 0 || heightOne === 0) return buf;

  const pixelsPerTile = width * heightOne;
  const emptyTileRle = [];
  let rem = pixelsPerTile;
  while (rem > 0) {
    const step = Math.min(255, rem);
    emptyTileRle.push(0, step);
    rem -= step;
  }
  const oneTileBuf = Buffer.from(emptyTileRle);
  const missing = requiredCount - count;
  const extra = Buffer.alloc(oneTileBuf.byteLength * missing);
  for (let i = 0; i < missing; i += 1) {
    oneTileBuf.copy(extra, i * oneTileBuf.byteLength);
  }

  const header = Buffer.alloc(12);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(heightOne, 4);
  header.writeUInt32BE(requiredCount, 8);
  return Buffer.concat([header, buf.subarray(12), extra]);
}

module.exports = {
  KOREAN_CATALOG_SLOTS,
  KOREAN_FONT_ALIASES,
  LATIN_FONT_ALIASES,
  decodeSelectionBin,
  encodeSelectionBin,
  padFontThumbnailSpriteBin,
  patchAllFontsSource,
};
