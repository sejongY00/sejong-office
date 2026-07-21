import type { DiagramKind } from '@/config/app';

interface PendingDiagramFile {
  kind: DiagramKind;
  file: File;
}

let pending: PendingDiagramFile | null = null;

export function stageDiagramFile(kind: DiagramKind, file: File) {
  pending = { kind, file };
}

export function consumeDiagramFile(kind: DiagramKind): File | null {
  if (pending?.kind !== kind) return null;
  const file = pending.file;
  pending = null;
  return file;
}
