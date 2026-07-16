import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { addDocument } from './sessionStore.js';
import type { SessionDoc } from '../types/session.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const BLANK_TYPES = ['docx', 'xlsx', 'pptx', 'pdf', 'hwpx'] as const;
export type BlankType = (typeof BLANK_TYPES)[number];

export function isBlankType(value: string): value is BlankType {
  return (BLANK_TYPES as readonly string[]).includes(value);
}

/** Resolve templates dir for both tsx (src) and compiled dist. */
async function templatesDir(): Promise<string> {
  const candidates = [
    path.resolve(__dirname, '../../templates'),
    path.resolve(__dirname, '../templates'),
  ];
  for (const dir of candidates) {
    try {
      await fs.access(dir);
      return dir;
    } catch {
      /* try next */
    }
  }
  return candidates[0];
}

export async function createBlankDocument(
  sessionId: string,
  type: BlankType,
): Promise<SessionDoc> {
  const dir = await templatesDir();
  const templatePath = path.join(dir, `blank.${type}`);
  const buffer = await fs.readFile(templatePath);
  const filename = `새문서.${type}`;
  return addDocument(sessionId, filename, type, buffer);
}
