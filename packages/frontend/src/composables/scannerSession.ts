let pending: File[] = [];

export function stageScannerFiles(files: readonly File[]) {
  pending = [...files];
}

export function consumeScannerFiles(): File[] {
  const files = pending;
  pending = [];
  return files;
}
