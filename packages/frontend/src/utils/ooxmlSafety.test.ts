import { unzipSync, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { validateAndSanitizeOfficeBlob } from './ooxmlSafety';

const enc = new TextEncoder();
const dec = new TextDecoder();
const FflateUint8Array = zipSync({}).constructor as new (length: number) => Uint8Array;

function toFflateU8(bytes: Uint8Array): Uint8Array {
  if (Object.getPrototypeOf(bytes) === FflateUint8Array.prototype) return bytes;
  const copy = new FflateUint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy;
}

function makeZipBlob(
  entries: Record<string, string | Uint8Array>,
  type = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
): Blob {
  const zipped = zipSync(
    Object.fromEntries(
      Object.entries(entries).map(([k, v]) => [k, toFflateU8(typeof v === 'string' ? enc.encode(v) : v)]),
    ),
  );
  return new Blob([zipped.slice()], { type });
}

describe('validateAndSanitizeOfficeBlob', () => {
  it('rejects an empty 0-byte blob with a clear Korean error', async () => {
    const empty = new Blob([], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    await expect(validateAndSanitizeOfficeBlob(empty, '문서.docx')).rejects.toThrow(/비어/);
  });

  it('rejects non-ZIP bytes and corrupted/truncated ZIP data for ZIP-based office formats', async () => {
    const notZip = new Blob([enc.encode('not-a-zip')], { type: 'application/octet-stream' });
    await expect(validateAndSanitizeOfficeBlob(notZip, '보고서.docx')).rejects.toThrow(/ZIP|압축/);
    await expect(validateAndSanitizeOfficeBlob(notZip, '시트.xlsx')).rejects.toThrow(/ZIP|압축/);

    // Has PK\x03\x04 magic bytes, but truncated/invalid archive structure.
    const corruptZip = new Blob([new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0xff])], {
      type: 'application/octet-stream',
    });
    await expect(validateAndSanitizeOfficeBlob(corruptZip, '보고서.docx')).rejects.toThrow(/손상/);
  });

  it('rejects .docx / .dotx missing [Content_Types].xml or word/document.xml', async () => {
    const missingDoc = makeZipBlob({
      '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8"?><Types/>',
      '_rels/.rels': '<?xml version="1.0" encoding="UTF-8"?><Relationships/>',
    });
    await expect(validateAndSanitizeOfficeBlob(missingDoc, 'broken.docx')).rejects.toThrow(
      /필수 구조/,
    );

    const missingTypes = makeZipBlob({
      'word/document.xml': '<?xml version="1.0" encoding="UTF-8"?><w:document/>',
    });
    await expect(validateAndSanitizeOfficeBlob(missingTypes, 'broken.dotx')).rejects.toThrow(
      /필수 구조/,
    );
  });

  it('removes ONLYOFFICE orphan word/_rels/comments.xml.rels while preserving _rels/.rels', async () => {
    const docx = makeZipBlob({
      '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8"?><Types/>',
      '_rels/.rels': '<?xml version="1.0" encoding="UTF-8"?><Relationships/>',
      'word/document.xml': '<?xml version="1.0" encoding="UTF-8"?><w:document/>',
      'word/_rels/document.xml.rels': '<?xml version="1.0" encoding="UTF-8"?><Relationships/>',
      'word/_rels/comments.xml.rels': '<?xml version="1.0" encoding="UTF-8"?><Relationships/>',
    });

    const sanitized = await validateAndSanitizeOfficeBlob(docx, 'onlyoffice.docx');
    expect(sanitized.type).toBe(docx.type);

    const entries = unzipSync(new Uint8Array(await sanitized.arrayBuffer()));
    expect(entries['_rels/.rels']).toBeDefined();
    expect(entries['word/_rels/document.xml.rels']).toBeDefined();
    expect(entries['word/_rels/comments.xml.rels']).toBeUndefined();
  });

  it('keeps word/_rels/comments.xml.rels when word/comments.xml exists', async () => {
    const docx = makeZipBlob({
      '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8"?><Types/>',
      '_rels/.rels': '<?xml version="1.0" encoding="UTF-8"?><Relationships/>',
      'word/document.xml': '<?xml version="1.0" encoding="UTF-8"?><w:document/>',
      'word/comments.xml': '<?xml version="1.0" encoding="UTF-8"?><w:comments/>',
      'word/_rels/comments.xml.rels': '<?xml version="1.0" encoding="UTF-8"?><Relationships/>',
    });

    const sanitized = await validateAndSanitizeOfficeBlob(docx, 'with-comments.docx');
    // Unmodified archive returns the original blob instance directly.
    expect(sanitized).toBe(docx);

    const entries = unzipSync(new Uint8Array(await sanitized.arrayBuffer()));
    expect(entries['word/_rels/comments.xml.rels']).toBeDefined();
  });

  it('prepends XML declaration to .xml entries missing <?xml ...?> (including BOM/whitespace)', async () => {
    const settingsWithBom = new Uint8Array([
      0xef,
      0xbb,
      0xbf,
      ...enc.encode('  \n<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"/>'),
    ]);
    const docx = makeZipBlob({
      '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8"?><Types/>',
      '_rels/.rels': '<?xml version="1.0" encoding="UTF-8"?><Relationships/>',
      'word/document.xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document/>',
      'word/settings.xml': settingsWithBom,
      'word/theme/theme1.xml': '<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"/>',
    });

    const file = new File([docx], 'memo.docx', { type: docx.type, lastModified: 4242 });
    const sanitized = await validateAndSanitizeOfficeBlob(file, 'memo.docx');
    expect(sanitized).toBeInstanceOf(File);
    expect((sanitized as File).name).toBe('memo.docx');
    expect(sanitized.type).toBe(docx.type);

    const entries = unzipSync(new Uint8Array(await sanitized.arrayBuffer()));
    expect(dec.decode(entries['word/document.xml'])).toBe(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document/>',
    );
    expect(dec.decode(entries['word/settings.xml'])).toBe(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"/>',
    );
    expect(dec.decode(entries['word/theme/theme1.xml'])).toBe(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"/>',
    );
  });
});
