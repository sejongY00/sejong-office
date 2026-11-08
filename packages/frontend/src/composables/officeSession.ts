// Hands the chosen office file to OfficeEditorView, which passes the bytes to the embedded editor
// (ranuts/document at OFFICE_EDITOR_URL) over postMessage. Memory only: nothing is uploaded, and
// a page reload drops it.

interface PendingOfficeDocument {
  name: string;
  buffer: ArrayBuffer;
}

let pending: PendingOfficeDocument | null = null;
let token = 0;

export async function stageOfficeFile(file: File): Promise<void> {
  stageOfficeBuffer(file.name, await file.arrayBuffer());
}

export function stageOfficeBuffer(name: string, buffer: ArrayBuffer): void {
  pending = { name, buffer };
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
