import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import fs from 'node:fs';
import { config } from './config.js';
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

  startSweeper();

  app.listen(config.port, () => {
    console.log(`[sejong-office] listening on :${config.port}`);
    console.log(`[sejong-office] tempDir=${config.tempDir}`);
    console.log(`[sejong-office] publicUrl=${config.publicUrl}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
