import { Router } from 'express';
import multer from 'multer';
import fs from 'node:fs/promises';
import { config, OFFICE_EXTENSIONS } from '../config.js';
import { logger } from '../logger.js';
import { requireSession } from '../middleware/session.js';
import {
  addDocument,
  deleteDocument,
  getDocument,
} from '../services/sessionStore.js';
import {
  buildEditorConfig,
  persistDocumentFromUrl,
} from '../services/onlyOffice.js';
import {
  createBlankDocument,
  isBlankType,
} from '../services/blankDocument.js';
import { extensionOf } from '../utils/formats.js';
import { decodeUploadFilename } from '../utils/filename.js';
import { extractToken, verifyOnlyOfficeToken } from '../utils/jwt.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxUploadMb * 1024 * 1024 },
});

export const documentsRouter = Router();

documentsRouter.post('/new', requireSession, async (req, res) => {
  const type = typeof req.body?.type === 'string' ? req.body.type.trim() : '';
  if (!isBlankType(type)) {
    res.status(400).json({
      error: 'unsupported_type',
      message: '지원 형식: docx, xlsx, pptx, pdf, hwpx',
    });
    return;
  }

  try {
    const doc = await createBlankDocument(
      res.locals.sessionId as string,
      type,
    );
    res.json({
      docId: doc.docId,
      filename: doc.filename,
      fileType: doc.fileType,
      documentType: doc.documentType,
      token: doc.token,
    });
  } catch (err) {
    logger.error('Failed to create blank document', { err });
    res.status(500).json({ error: 'create_failed' });
  }
});

documentsRouter.post(
  '/',
  requireSession,
  upload.single('file'),
  async (req, res) => {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'file_required' });
      return;
    }

    // Prefer explicit UTF-8 field from client; fall back to multer name fix
    const fromField =
      typeof req.body?.filename === 'string' ? req.body.filename.trim() : '';
    const originalFilename =
      fromField || decodeUploadFilename(file.originalname);

    const fileType = extensionOf(originalFilename);
    if (!OFFICE_EXTENSIONS.has(fileType)) {
      res.status(400).json({
        error: 'unsupported_type',
        message:
          '이 API는 오피스/PDF용입니다. HWP/HWPX는 클라이언트(rhwp)에서 처리하세요.',
      });
      return;
    }

    try {
      const doc = await addDocument(
        res.locals.sessionId as string,
        originalFilename,
        fileType,
        file.buffer,
      );
      res.json({
        docId: doc.docId,
        filename: doc.filename,
        fileType: doc.fileType,
        documentType: doc.documentType,
      });
    } catch (err) {
      logger.error('Failed to upload document', { err });
      res.status(500).json({ error: 'upload_failed' });
    }
  },
);

documentsRouter.get('/:docId/editor-config', requireSession, (req, res) => {
  const doc = getDocument(req.params.docId);
  if (!doc || doc.sessionId !== res.locals.sessionId) {
    res.status(404).json({ error: 'not_found' });
    return;
  }

  const configPayload = buildEditorConfig(doc, res.locals.sessionId as string);
  res.json(configPayload);
});

documentsRouter.get('/:docId/content', async (req, res) => {
  const doc = getDocument(req.params.docId);
  const token = typeof req.query.token === 'string' ? req.query.token : '';
  if (!doc || !token || token !== doc.token) {
    res.status(403).json({ error: 'forbidden' });
    return;
  }

  try {
    const data = await fs.readFile(doc.path);
    res.setHeader('Content-Type', doc.mime);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(doc.filename)}`,
    );
    res.send(data);
  } catch {
    res.status(404).json({ error: 'not_found' });
  }
});

documentsRouter.post('/:docId/callback', async (req, res) => {
  const doc = getDocument(req.params.docId);
  if (!doc) {
    res.json({ error: 0 });
    return;
  }

  try {
    const token = extractToken(req);
    if (token) {
      verifyOnlyOfficeToken(token);
    }
  } catch (err) {
    logger.warn('Invalid callback JWT', { err, docId: req.params.docId });
    res.status(403).json({ error: 1 });
    return;
  }

  const body = req.body as {
    status?: number;
    url?: string;
    filetype?: string;
    token?: string;
  };

  // Unwrap JWT body if OnlyOffice sent signed payload only
  let status = body.status;
  let fileUrl = body.url;
  let filetype = body.filetype;

  if (body.token && status === undefined) {
    try {
      const payload = verifyOnlyOfficeToken(body.token) as {
        status?: number;
        url?: string;
        filetype?: string;
      };
      status = payload.status;
      fileUrl = payload.url;
      filetype = payload.filetype;
    } catch {
      /* use body fields */
    }
  }

  if (status === 2 || status === 6) {
    if (!fileUrl) {
      res.json({ error: 1 });
      return;
    }

    try {
      await persistDocumentFromUrl(doc, fileUrl, filetype);
    } catch (err) {
      logger.error('Failed to save callback document', {
        err,
        docId: req.params.docId,
      });
      res.json({ error: 1 });
      return;
    }
  }

  res.json({ error: 0 });
});

documentsRouter.get('/:docId/download', requireSession, async (req, res) => {
  const doc = getDocument(req.params.docId);
  if (!doc || doc.sessionId !== res.locals.sessionId) {
    res.status(404).json({ error: 'not_found' });
    return;
  }

  try {
    const data = await fs.readFile(doc.path);
    res.setHeader('Content-Type', doc.mime);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(doc.filename)}`,
    );
    res.send(data);
  } catch {
    res.status(404).json({ error: 'not_found' });
  }
});

documentsRouter.delete('/:docId', requireSession, async (req, res) => {
  const doc = getDocument(req.params.docId);
  if (!doc || doc.sessionId !== res.locals.sessionId) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  await deleteDocument(doc.docId);
  res.json({ ok: true });
});
