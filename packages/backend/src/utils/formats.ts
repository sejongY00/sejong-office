import type { DocumentType } from '../types/session.js';

const WORD = new Set([
  'doc',
  'docm',
  'docx',
  'dot',
  'dotm',
  'dotx',
  'epub',
  'fodt',
  'htm',
  'html',
  'odt',
  'ott',
  'rtf',
  'txt',
  'xml',
]);

const CELL = new Set([
  'csv',
  'fods',
  'ods',
  'ots',
  'xls',
  'xlsb',
  'xlsm',
  'xlsx',
  'xlt',
  'xltm',
  'xltx',
]);

const SLIDE = new Set([
  'fodp',
  'odp',
  'otp',
  'pot',
  'potm',
  'potx',
  'pps',
  'ppsm',
  'ppsx',
  'ppt',
  'pptm',
  'pptx',
]);

const PDF = new Set(['pdf', 'djvu', 'xps', 'oxps']);

export function extensionOf(filename: string): string {
  const idx = filename.lastIndexOf('.');
  if (idx < 0) return '';
  return filename.slice(idx + 1).toLowerCase();
}

export function documentTypeFor(ext: string): DocumentType {
  if (PDF.has(ext)) return 'pdf';
  if (CELL.has(ext)) return 'cell';
  if (SLIDE.has(ext)) return 'slide';
  if (WORD.has(ext)) return 'word';
  return 'word';
}

export function mimeFor(ext: string): string {
  const map: Record<string, string> = {
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    pdf: 'application/pdf',
    odt: 'application/vnd.oasis.opendocument.text',
    ods: 'application/vnd.oasis.opendocument.spreadsheet',
    odp: 'application/vnd.oasis.opendocument.presentation',
    doc: 'application/msword',
    xls: 'application/vnd.ms-excel',
    ppt: 'application/vnd.ms-powerpoint',
    rtf: 'application/rtf',
    txt: 'text/plain',
    csv: 'text/csv',
    hwp: 'application/x-hwp',
    hwpx: 'application/hwp+zip',
  };
  return map[ext] ?? 'application/octet-stream';
}
