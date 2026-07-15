import fs from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config.js';
import type { Session, SessionDoc } from '../types/session.js';
import { documentTypeFor, mimeFor } from '../utils/formats.js';

const sessions = new Map<string, Session>();

function now(): number {
  return Date.now();
}

function makeKey(docId: string, version = 0): string {
  return `${docId}_${version}_${randomBytes(4).toString('hex')}`;
}

export async function ensureTempRoot(): Promise<void> {
  await fs.mkdir(config.tempDir, { recursive: true });
}

export async function wipeTempRoot(): Promise<void> {
  try {
    await fs.rm(config.tempDir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
  await ensureTempRoot();
  sessions.clear();
}

export function createSession(): Session {
  const sessionId = uuidv4();
  const t = now();
  const session: Session = {
    sessionId,
    lastSeenAt: t,
    createdAt: t,
    docs: new Map(),
  };
  sessions.set(sessionId, session);
  return session;
}

export function getSession(sessionId: string): Session | undefined {
  return sessions.get(sessionId);
}

export function touchSession(sessionId: string): boolean {
  const session = sessions.get(sessionId);
  if (!session) return false;
  session.lastSeenAt = now();
  return true;
}

export async function deleteSession(sessionId: string): Promise<boolean> {
  const session = sessions.get(sessionId);
  if (!session) return false;
  const dir = path.join(config.tempDir, sessionId);
  sessions.delete(sessionId);
  await fs.rm(dir, { recursive: true, force: true });
  return true;
}

export async function addDocument(
  sessionId: string,
  originalFilename: string,
  fileType: string,
  buffer: Buffer,
): Promise<SessionDoc> {
  const session = sessions.get(sessionId);
  if (!session) {
    throw new Error('SESSION_NOT_FOUND');
  }

  const docId = uuidv4();
  const token = randomBytes(24).toString('hex');
  const dir = path.join(config.tempDir, sessionId, docId);
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, `document.${fileType}`);
  await fs.writeFile(filePath, buffer);

  const t = now();
  const doc: SessionDoc = {
    sessionId,
    docId,
    key: makeKey(docId),
    filename: originalFilename,
    originalFilename,
    mime: mimeFor(fileType),
    fileType,
    documentType: documentTypeFor(fileType),
    path: filePath,
    token,
    lastSeenAt: t,
    createdAt: t,
  };

  session.docs.set(docId, doc);
  session.lastSeenAt = t;
  return doc;
}

export function getDocument(docId: string): SessionDoc | undefined {
  for (const session of sessions.values()) {
    const doc = session.docs.get(docId);
    if (doc) return doc;
  }
  return undefined;
}

export async function overwriteDocument(
  doc: SessionDoc,
  buffer: Buffer,
  fileType?: string,
): Promise<void> {
  const ext = fileType ?? doc.fileType;
  if (ext !== doc.fileType) {
    throw new Error('FILETYPE_MISMATCH');
  }
  await fs.writeFile(doc.path, buffer);
  doc.lastSeenAt = now();
  doc.key = makeKey(doc.docId, now());
  const session = sessions.get(doc.sessionId);
  if (session) session.lastSeenAt = doc.lastSeenAt;
}

export async function deleteDocument(docId: string): Promise<boolean> {
  for (const session of sessions.values()) {
    const doc = session.docs.get(docId);
    if (!doc) continue;
    session.docs.delete(docId);
    await fs.rm(path.dirname(doc.path), { recursive: true, force: true });
    return true;
  }
  return false;
}

export async function sweepExpired(): Promise<number> {
  const cutoff = now() - config.sessionTtlMs;
  let removed = 0;
  for (const [id, session] of sessions) {
    if (session.lastSeenAt < cutoff) {
      await deleteSession(id);
      removed += 1;
    }
  }
  return removed;
}

export function startSweeper(intervalMs = 60_000): NodeJS.Timeout {
  return setInterval(() => {
    void sweepExpired().then((n) => {
      if (n > 0) {
        console.log(`[session] swept ${n} expired session(s)`);
      }
    });
  }, intervalMs);
}
