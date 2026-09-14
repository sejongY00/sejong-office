let pending: File | null = null;

export function stageImageEditFile(file: File) {
  pending = file;
}

export function consumeImageEditFile(): File | null {
  const file = pending;
  pending = null;
  return file;
}
