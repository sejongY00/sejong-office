import { readFromDisk } from '@/utils/fileAccess';

export interface FileLaunchParams {
  readonly targetURL?: string;
  readonly files: readonly FileSystemHandle[];
}

export interface FileLaunchQueue {
  setConsumer(consumer: (launchParams: FileLaunchParams) => void): void;
}

function isCancelledOrDenied(err: unknown): boolean {
  return (
    err instanceof DOMException &&
    (err.name === 'AbortError' || err.name === 'NotAllowedError')
  );
}

/**
 * Receives files opened from the OS (Windows Explorer / macOS Finder) via the PWA File Handling
 * API (`window.launchQueue`). Each handle is read through `readFromDisk` so Save overwrites the
 * same file on disk and external-change detection stays armed.
 */
export function registerFileLaunch(
  launchQueue: FileLaunchQueue | undefined,
  openFiles: (files: File[]) => void | Promise<unknown>,
  onError?: (err: unknown) => void,
): boolean {
  if (!launchQueue) return false;

  launchQueue.setConsumer((launchParams) => {
    const fileHandles = (launchParams.files ?? []).filter(
      (handle): handle is FileSystemFileHandle => handle.kind === 'file',
    );
    if (!fileHandles.length) return;

    void (async () => {
      try {
        const files = await Promise.all(fileHandles.map((handle) => readFromDisk(handle)));
        if (files.length) await openFiles(files);
      } catch (err) {
        if (!isCancelledOrDenied(err)) onError?.(err);
      }
    })();
  });

  return true;
}
