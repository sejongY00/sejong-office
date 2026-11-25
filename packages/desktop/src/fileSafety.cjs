const crypto = require('node:crypto');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { types } = require('node:util');

const ZIP_CONTAINER_EXTS = new Set([
  '.docx',
  '.dotx',
  '.xlsx',
  '.xltx',
  '.pptx',
  '.potx',
  '.odt',
  '.ods',
  '.odp',
  '.hwpx',
]);

const OLE2_EXTS = new Set(['.hwp', '.doc', '.xls', '.ppt']);

const OTHER_BINARY_OFFICE_EXTS = new Set([
  '.docm',
  '.dotm',
  '.xlsm',
  '.xltm',
  '.pptm',
  '.potm',
  '.ppsx',
  '.ppsm',
  '.sldx',
  '.sldm',
  '.xlsb',
  '.pps',
  '.pot',
  '.xlt',
  '.dot',
  '.rtf',
  '.hwt',
  '.hml',
  '.odg',
  '.odf',
  '.odb',
  '.xps',
  '.oxps',
  '.epub',
  '.djvu',
  '.fb2',
  '.pages',
  '.numbers',
  '.key',
  '.wps',
  '.et',
  '.dps',
]);

const ZIP_LOCAL_HEADER = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const ZIP_EOCD_SIG = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
const ZIP_MIN_BYTES = 22;
const ZIP_EOCD_MAX_SEARCH_BYTES = 65557;

const PDF_HEADER = Buffer.from('%PDF-', 'ascii');

const OLE2_HEADER = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
const OLE2_MIN_BYTES = 512;

/** Per-path serialization queue for atomic file writes. */
const writeQueues = new Map();

function isZipContainerExt(filePath) {
  if (typeof filePath !== 'string') return false;
  const ext = path.extname(filePath).toLowerCase();
  return ZIP_CONTAINER_EXTS.has(ext);
}

function toBuffer(data) {
  if (Buffer.isBuffer(data)) return data;
  if (types.isUint8Array(data)) {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  }
  return null;
}

/**
 * Validate write payload before touching disk so empty or corrupted buffers
 * cannot overwrite valid documents.
 */
function validateFileWritePayload(filePath, data) {
  if (typeof filePath !== 'string' || filePath.trim().length === 0) {
    return { ok: false, error: '저장할 파일 경로가 올바르지 않습니다.' };
  }

  const buffer = toBuffer(data);
  if (!buffer) {
    return { ok: false, error: '저장할 데이터가 올바른 바이너리 버퍼(Buffer/Uint8Array)가 아닙니다.' };
  }

  const ext = path.extname(filePath).toLowerCase();

  if (isZipContainerExt(filePath)) {
    if (buffer.length === 0) {
      return { ok: false, error: `${ext} 문서가 비어 있어(0바이트) 저장을 중단했습니다.` };
    }
    if (buffer.length < ZIP_MIN_BYTES) {
      return {
        ok: false,
        error: `${ext} 문서 크기(${buffer.length}바이트)가 최소 ZIP 크기(${ZIP_MIN_BYTES}바이트)보다 작아 저장을 중단했습니다.`,
      };
    }
    if (!buffer.subarray(0, 4).equals(ZIP_LOCAL_HEADER)) {
      return {
        ok: false,
        error: `${ext} 문서의 ZIP 헤더(PK\\x03\\x04)가 손상되어 저장을 중단했습니다.`,
      };
    }
    const searchLen = Math.min(buffer.length, ZIP_EOCD_MAX_SEARCH_BYTES);
    const tail = buffer.subarray(buffer.length - searchLen);
    if (tail.lastIndexOf(ZIP_EOCD_SIG) === -1) {
      return {
        ok: false,
        error: `${ext} 문서의 ZIP 끝(EOCD) 시그니처가 누락되어 저장을 중단했습니다.`,
      };
    }
    return { ok: true, buffer };
  }

  if (ext === '.pdf') {
    if (buffer.length === 0) {
      return { ok: false, error: 'PDF 문서가 비어 있어(0바이트) 저장을 중단했습니다.' };
    }
    if (buffer.length < PDF_HEADER.length || !buffer.subarray(0, PDF_HEADER.length).equals(PDF_HEADER)) {
      return {
        ok: false,
        error: 'PDF 문서 헤더(%PDF-)가 올바르지 않아 저장을 중단했습니다.',
      };
    }
    return { ok: true, buffer };
  }

  if (OLE2_EXTS.has(ext)) {
    if (buffer.length === 0) {
      return { ok: false, error: `${ext} 문서가 비어 있어(0바이트) 저장을 중단했습니다.` };
    }
    if (buffer.length < OLE2_MIN_BYTES) {
      return {
        ok: false,
        error: `${ext} 문서 크기(${buffer.length}바이트)가 OLE2 최소 크기(${OLE2_MIN_BYTES}바이트)보다 작아 저장을 중단했습니다.`,
      };
    }
    if (!buffer.subarray(0, OLE2_HEADER.length).equals(OLE2_HEADER)) {
      return {
        ok: false,
        error: `${ext} 문서의 OLE2 시그니처가 올바르지 않아 저장을 중단했습니다.`,
      };
    }
    return { ok: true, buffer };
  }

  if (OTHER_BINARY_OFFICE_EXTS.has(ext) && buffer.length === 0) {
    return { ok: false, error: `${ext} 오피스 문서가 비어 있어(0바이트) 저장을 중단했습니다.` };
  }

  return { ok: true, buffer };
}

function buildTempSiblingPath(resolvedPath) {
  const dir = path.dirname(resolvedPath);
  const base = path.basename(resolvedPath);
  const uniqueSuffix = `${process.pid}-${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
  const namedCandidate = `.${base}.${uniqueSuffix}.tmp`;
  // Avoid ENAMETOOLONG on macOS/APFS with long Korean NFD filenames (3x UTF-8 bytes per syllable)
  const fileName =
    Buffer.byteLength(namedCandidate, 'utf8') <= 240
      ? namedCandidate
      : `.sejong-${uniqueSuffix}.tmp`;
  return path.join(dir, fileName);
}

function enqueuePathWrite(queueKey, task) {
  const prev = writeQueues.get(queueKey) || Promise.resolve();
  const next = prev.catch(() => {}).then(task);
  writeQueues.set(queueKey, next);
  next.finally(() => {
    if (writeQueues.get(queueKey) === next) {
      writeQueues.delete(queueKey);
    }
  });
  return next;
}

/**
 * Validate payload and atomically replace `filePath` via a sibling temp file, fsync, and rename.
 * Concurrent writes to the same resolved path are serialized through an in-memory Promise queue.
 */
async function writeFileAtomically(filePath, data) {
  const validation = validateFileWritePayload(filePath, data);
  if (!validation.ok) {
    const err = new Error(validation.error);
    err.code = 'EINVALIDPAYLOAD';
    throw err;
  }

  const resolved = path.resolve(filePath);
  const queueKey = process.platform === 'darwin' ? resolved.normalize('NFC') : resolved;
  const { buffer } = validation;

  return enqueuePathWrite(queueKey, async () => {
    let existingMode = null;
    try {
      const existingStat = await fsp.stat(resolved);
      existingMode = existingStat.mode & 0o777;
    } catch (err) {
      if (!err || err.code !== 'ENOENT') {
        throw err;
      }
    }

    const tmpPath = buildTempSiblingPath(resolved);
    let fh = null;
    try {
      fh = await fsp.open(tmpPath, 'wx', existingMode ?? 0o666);
      await fh.writeFile(buffer);
      await fh.sync();
      await fh.close();
      fh = null;

      if (existingMode !== null) {
        await fsp.chmod(tmpPath, existingMode);
      }

      await fsp.rename(tmpPath, resolved);
      const stat = await fsp.stat(resolved);
      return {
        lastModified: Math.floor(stat.mtimeMs),
        bytes: buffer.length,
      };
    } catch (err) {
      if (fh) {
        await fh.close().catch(() => {});
      }
      await fsp.rm(tmpPath, { force: true }).catch(() => {});
      throw err;
    }
  });
}

function sanitizeLogValue(value, seen = new WeakSet(), depth = 0) {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (Buffer.isBuffer(value) || types.isUint8Array(value)) {
    return `[Binary bytes=${value.byteLength}]`;
  }
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      ...(value.code !== undefined ? { code: value.code } : {}),
    };
  }
  if (depth >= 4) {
    return '[MaxDepth]';
  }
  if (typeof value === 'object') {
    if (seen.has(value)) return '[Circular]';
    seen.add(value);
    if (Array.isArray(value)) {
      return value.map((item) => sanitizeLogValue(item, seen, depth + 1));
    }
    const out = {};
    for (const [key, item] of Object.entries(value)) {
      if (item !== undefined && typeof item !== 'function') {
        out[key] = sanitizeLogValue(item, seen, depth + 1);
      }
    }
    return out;
  }
  return String(value);
}

/**
 * Create a non-throwing structured JSON-lines logger with single-file rotation (`<fileName>.1`).
 */
function createAppLogger({ logDir, fileName = 'sejong-office.log', maxBytes = 1024 * 1024 } = {}) {
  const resolvedDir = typeof logDir === 'string' && logDir.trim() ? path.resolve(logDir) : '';
  const logPath = resolvedDir ? path.join(resolvedDir, fileName) : '';
  const rotatedPath = logPath ? `${logPath}.1` : '';
  const limitBytes = typeof maxBytes === 'number' && maxBytes > 0 ? maxBytes : 1024 * 1024;
  let dirEnsured = false;

  function log(level, event, meta) {
    if (!logPath) return;
    try {
      if (!dirEnsured) {
        fs.mkdirSync(resolvedDir, { recursive: true });
        dirEnsured = true;
      }

      const record = {
        ts: new Date().toISOString(),
        level: String(level || 'info'),
        event: String(event || 'event'),
      };
      if (meta !== undefined) {
        record.meta = sanitizeLogValue(meta);
      }

      const line = `${JSON.stringify(record)}\n`;
      const lineBytes = Buffer.byteLength(line, 'utf8');

      try {
        const stat = fs.statSync(logPath);
        if (stat.size > 0 && stat.size + lineBytes > limitBytes) {
          fs.rmSync(rotatedPath, { force: true });
          fs.renameSync(logPath, rotatedPath);
        }
      } catch (err) {
        if (!err || err.code !== 'ENOENT') {
          // Ignore stat/rotation errors so logging never breaks app flow
        }
      }

      fs.appendFileSync(logPath, line, 'utf8');
    } catch {
      // Non-throwing logger by design
    }
  }

  return {
    log,
    logPath,
    rotatedPath,
  };
}

module.exports = {
  isZipContainerExt,
  validateFileWritePayload,
  writeFileAtomically,
  createAppLogger,
};
