const HANGUL_RE = /[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7A3]/;

/**
 * Multer/busboy often decodes multipart filenames as Latin-1.
 * UTF-8 Hangul then appears as mojibake (e.g. áá©…).
 * Prefer an explicit UTF-8 `filename` form field from the client when present.
 */
export function decodeUploadFilename(name: string): string {
  if (!name) return name;
  if (HANGUL_RE.test(name)) return name;

  try {
    const decoded = Buffer.from(name, 'latin1').toString('utf8');
    if (decoded.includes('\uFFFD')) return name;
    if (HANGUL_RE.test(decoded)) return decoded;
    return name;
  } catch {
    return name;
  }
}
