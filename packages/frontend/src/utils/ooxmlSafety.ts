import { unzipSync, zipSync } from 'fflate';
import { extensionOf } from '@/config/app';

const ZIP_OFFICE_EXTENSIONS = new Set([
  'docx',
  'dotx',
  'xlsx',
  'xltx',
  'pptx',
  'potx',
  'odt',
  'ods',
  'odp',
  'hwpx',
]);

const DOCX_EXTENSIONS = new Set(['docx', 'dotx']);
const XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const PART_RELS_PATTERN = /^(?:(.*)\/)?_rels\/([^/]+)\.rels$/;

const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
const utf8Encoder = new TextEncoder();
// fflate 0.8.2 checks `val instanceof u8` inside zipSync(), which fails in Vitest jsdom if a
// Uint8Array came from another realm (e.g. Node TextEncoder or jsdom Blob.arrayBuffer()).
const FflateUint8Array = zipSync({}).constructor as new (length: number) => Uint8Array;

function toZipEntryBytes(bytes: Uint8Array): Uint8Array {
  if (Object.getPrototypeOf(bytes) === FflateUint8Array.prototype) return bytes;
  const copy = new FflateUint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy;
}

function hasEntry(entries: Record<string, Uint8Array>, path: string): boolean {
  return Object.prototype.hasOwnProperty.call(entries, path);
}

function isOrphanPartRels(path: string, entries: Record<string, Uint8Array>): boolean {
  if (path === '_rels/.rels') return false;
  const match = PART_RELS_PATTERN.exec(path);
  if (!match) return false;
  const dir = match[1];
  const partName = match[2];
  const ownerPath = dir ? `${dir}/${partName}` : partName;
  return !hasEntry(entries, ownerPath);
}

function ensureXmlDeclaration(raw: Uint8Array): Uint8Array | null {
  const hasBom = raw.length >= 3 && raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf;
  const body = hasBom ? raw.subarray(3) : raw;
  let text: string;
  try {
    text = utf8Decoder.decode(body);
  } catch {
    return null;
  }
  const trimmed = text.trimStart();
  if (!trimmed.startsWith('<')) return null;
  if (/^<\?xml(?:\s|\?>)/i.test(trimmed)) return null;
  return toZipEntryBytes(utf8Encoder.encode(`${XML_DECLARATION}${trimmed}`));
}

/**
 * Validates exported office blobs before writing to disk and normalizes known ONLYOFFICE OOXML
 * quirks (orphan part `.rels` entries and missing XML declarations) on `.docx`/`.dotx` archives.
 */
export async function validateAndSanitizeOfficeBlob(
  blob: Blob,
  fileName: string,
): Promise<Blob> {
  if (!blob || blob.size === 0) {
    throw new Error('저장할 파일 데이터가 비어 있어 저장할 수 없습니다.');
  }

  const ext = extensionOf(fileName);
  if (!ZIP_OFFICE_EXTENSIONS.has(ext)) {
    return blob;
  }

  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (
    bytes.length < 4 ||
    bytes[0] !== 0x50 ||
    bytes[1] !== 0x4b ||
    bytes[2] !== 0x03 ||
    bytes[3] !== 0x04
  ) {
    throw new Error('올바른 문서 압축 형식(ZIP)이 아니어서 저장할 수 없습니다.');
  }

  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes);
  } catch {
    throw new Error('손상되었거나 불완전한 문서 파일이어서 저장할 수 없습니다.');
  }

  if (Object.keys(entries).length === 0) {
    throw new Error('문서 내부 항목이 비어 있어 저장할 수 없습니다.');
  }

  if (!DOCX_EXTENSIONS.has(ext)) {
    return blob;
  }

  if (!hasEntry(entries, '[Content_Types].xml') || !hasEntry(entries, 'word/document.xml')) {
    throw new Error(
      'DOCX 필수 구조([Content_Types].xml 또는 word/document.xml)가 누락되어 저장할 수 없습니다.',
    );
  }

  const sanitized: Record<string, Uint8Array> = {};
  let modified = false;

  for (const [entryPath, raw] of Object.entries(entries)) {
    if (isOrphanPartRels(entryPath, entries)) {
      modified = true;
      continue;
    }
    if (entryPath.toLowerCase().endsWith('.xml')) {
      const updated = ensureXmlDeclaration(raw);
      if (updated) {
        sanitized[entryPath] = updated;
        modified = true;
        continue;
      }
    }
    sanitized[entryPath] = toZipEntryBytes(raw);
  }

  if (!modified) {
    return blob;
  }

  const rezipped = zipSync(sanitized);
  try {
    unzipSync(rezipped);
  } catch {
    throw new Error('문서 압축 데이터를 검증하는 중 오류가 발생했습니다.');
  }

  const copy = rezipped.slice();
  if (blob instanceof File) {
    return new File([copy], blob.name, {
      type: blob.type,
      lastModified: blob.lastModified,
    });
  }
  return new Blob([copy], { type: blob.type });
}
