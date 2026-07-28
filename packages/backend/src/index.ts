import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import fs from 'node:fs';
import { config } from './config.js';
import { logger, requestLogger } from './logger.js';
import { sessionsRouter } from './routes/sessions.js';
import { documentsRouter } from './routes/documents.js';
import {
  ensureTempRoot,
  startSweeper,
  wipeTempRoot,
} from './services/sessionStore.js';

async function main() {
  await wipeTempRoot();
  await ensureTempRoot();

  const app = express();

  app.use(requestLogger);
  app.use(
    cors({
      origin: true,
      credentials: true,
    }),
  );
  app.use(cookieParser());
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      onlyOfficeUrl: config.onlyOfficeUrl,
      sessionTtlMs: config.sessionTtlMs,
    });
  });

  app.use('/api/sessions', sessionsRouter);
  app.use('/api/documents', documentsRouter);

  if (fs.existsSync(config.publicDir)) {
    app.use(express.static(config.publicDir, {
      setHeaders(res, filePath) {
        if (filePath.endsWith('.wasm')) {
          res.setHeader('Content-Type', 'application/wasm');
        }
      },
    }));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) {
        next();
        return;
      }
      // Do not SPA-fallback missing static assets (wasm, workers, traineddata).
      if (/\.[a-z0-9]+$/i.test(req.path)) {
        res.status(404).end();
        return;
      }
      res.sendFile(path.join(config.publicDir, 'index.html'));
    });
  }

  app.use((err: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error('Unhandled request error', { err, path: req.path });
    if (!res.headersSent) {
      res.status(500).json({ error: 'internal_server_error' });
    }
  });

  startSweeper();

  app.listen(config.port, () => {
    logger.info(`Backend listening on :${config.port}`);
    logger.info(`Temp directory: ${config.tempDir}`);
    logger.info(`Public URL: ${config.publicUrl}`);
  });
}

main().catch((err) => {
  logger.error('Backend failed to start', { err });
  process.exit(1);
});
