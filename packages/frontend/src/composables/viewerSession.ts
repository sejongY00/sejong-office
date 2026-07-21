import type { ViewerKind } from '@/config/app';

interface PendingViewerFiles {
  kind: ViewerKind;
  files: File[];
}

let pending: PendingViewerFiles | null = null;

export function stageViewerFiles(kind: ViewerKind, files: readonly File[]) {
  pending = { kind, files: [...files] };
}

export function consumeViewerFiles(kind: ViewerKind): File[] {
  if (pending?.kind !== kind) return [];
  const files = pending.files;
  pending = null;
  return files;
}
