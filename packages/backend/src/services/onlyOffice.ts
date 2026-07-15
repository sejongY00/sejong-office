import { config } from '../config.js';
import type { SessionDoc } from '../types/session.js';
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
      console.error('[convert] HTTP', res.status);
      return null;
    }

    const data = (await res.json()) as {
      error?: number;
      fileUrl?: string;
      endConvert?: boolean;
    };

    if (data.error || !data.fileUrl) {
      console.error('[convert] failed', data);
      return null;
    }

    const fileRes = await fetch(data.fileUrl);
    if (!fileRes.ok) return null;
    return Buffer.from(await fileRes.arrayBuffer());
  } catch (err) {
    console.error('[convert] error', err);
    return null;
  }
}
