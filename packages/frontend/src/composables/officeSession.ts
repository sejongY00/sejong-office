// Hands the chosen office file to OfficeEditorView, which passes the bytes to the embedded editor
// (ranuts/document at OFFICE_EDITOR_URL) over postMessage. Memory only: nothing is uploaded, and
// a page reload drops it.

import { handleOf } from '@/utils/fileAccess';

interface PendingOfficeDocument {
  name: string;
  buffer: ArrayBuffer;
  /** The opened file on disk, so Save can overwrite it. */
  handle: FileSystemFileHandle | null;
}

let pending: PendingOfficeDocument | null = null;
let token = 0;

export async function stageOfficeFile(file: File): Promise<void> {
  stageOfficeBuffer(file.name, await file.arrayBuffer(), handleOf(file));
}

export function stageOfficeBuffer(
  name: string,
  buffer: ArrayBuffer,
  handle: FileSystemFileHandle | null = null,
): void {
  pending = { name, buffer, handle };
  token += 1;
}

/** Changes on every staged document so the keep-alive view remounts with the new file. */
export function officeOpenToken(): number {
  return token;
}

export function consumeOfficeDocument(): PendingOfficeDocument | null {
  const doc = pending;
  pending = null;
  return doc;
}
