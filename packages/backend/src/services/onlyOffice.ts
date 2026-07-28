import { config } from '../config.js';
import { logger } from '../logger.js';
import type { SessionDoc } from '../types/session.js';
import { overwriteDocument } from './sessionStore.js';
import { signOnlyOfficePayload } from '../utils/jwt.js';

export function buildEditorConfig(doc: SessionDoc, userId: string) {
  const contentUrl = `${config.internalUrl}/api/documents/${doc.docId}/content?token=${doc.token}`;
  const callbackUrl = `${config.internalUrl}/api/documents/${doc.docId}/callback`;

  const document = {
    fileType: doc.fileType,
    key: doc.key,
    title: doc.filename,
    url: contentUrl,
    permissions: {
      edit: true,
      download: true,
      print: true,
    },
  };

  const editorConfig = {
    callbackUrl,
    mode: 'edit' as const,
    lang: 'ko',
    user: {
      id: userId,
      name: 'Guest',
    },
    customization: {
      forcesave: true,
      goback: false,
    },
  };

  const payload = {
    documentType: doc.documentType,
    document,
    editorConfig,
  };

  const token = signOnlyOfficePayload(payload);

  return {
    documentType: doc.documentType,
    document,
    editorConfig,
    token,
    documentServerUrl: config.onlyOfficeUrl,
  };
}

/** Prefer the internal Document Server base when the backend fetches the file. */
export function toInternalOnlyOfficeUrl(raw: string): string {
  try {
    const target = new URL(raw);
    const publicBase = new URL(config.onlyOfficeUrl);
    const internalBase = new URL(config.onlyOfficeInternalUrl);
    if (
      target.host === publicBase.host ||
      target.host === internalBase.host
    ) {
      target.protocol = internalBase.protocol;
      target.host = internalBase.host;
    }
    return target.toString();
  } catch {
    return raw;
  }
}

/**
 * Download an OnlyOffice-produced file URL and overwrite the session document
 * (converting back to the original extension when needed).
 */
export async function persistDocumentFromUrl(
  doc: SessionDoc,
  fileUrl: string,
  filetype?: string,
): Promise<Buffer> {
  const fetchUrl = toInternalOnlyOfficeUrl(fileUrl);
  const downloaded = await fetch(fetchUrl);
  if (!downloaded.ok) {
    throw new Error(`download_failed_${downloaded.status}`);
  }

  let buffer: Buffer = Buffer.from(await downloaded.arrayBuffer());
  const returnedType = (filetype ?? doc.fileType).toLowerCase();

  if (returnedType !== doc.fileType) {
    const converted = await convertToOriginalFormat(
      fetchUrl,
      returnedType,
      doc.fileType,
    );
    if (!converted) {
      throw new Error(`convert_failed:${returnedType}->${doc.fileType}`);
    }
    buffer = Buffer.from(converted);
  }

  await overwriteDocument(doc, buffer, doc.fileType);
  return buffer;
}

export async function convertToOriginalFormat(
  sourceUrl: string,
  fromExt: string,
  toExt: string,
): Promise<Buffer | null> {
  if (fromExt === toExt) return null;

  const convertUrl = `${config.onlyOfficeInternalUrl}/ConvertService.ashx`;
  const key = `conv_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  const body = {
    async: false,
    filetype: fromExt,
    key,
    outputtype: toExt,
    url: sourceUrl,
  };

  const token = signOnlyOfficePayload(body);

  try {
    const res = await fetch(convertUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ ...body, token }),
    });

    if (!res.ok) {
      logger.error('OnlyOffice conversion HTTP error', {
        statusCode: res.status,
      });
      return null;
    }

    const data = (await res.json()) as {
      error?: number;
      fileUrl?: string;
      endConvert?: boolean;
    };

    if (data.error || !data.fileUrl) {
      logger.error('OnlyOffice conversion failed', {
        errorCode: data.error,
        hasFileUrl: Boolean(data.fileUrl),
      });
      return null;
    }

    const fileRes = await fetch(data.fileUrl);
    if (!fileRes.ok) return null;
    return Buffer.from(await fileRes.arrayBuffer());
  } catch (err) {
    logger.error('OnlyOffice conversion error', { err });
    return null;
  }
}
