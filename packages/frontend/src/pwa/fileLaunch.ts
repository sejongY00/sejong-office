import { readFromDisk } from '@/utils/fileAccess';

export interface FileLaunchParams {
  readonly targetURL?: string;
  readonly files: readonly FileSystemHandle[];
}

export interface FileLaunchQueue {
  setConsumer(consumer: (launchParams: FileLaunchParams) => void): void;
}

export interface DesktopFileSnapshot {
  readonly path: string;
  readonly name: string;
  readonly bytes: Uint8Array;
  readonly lastModified: number;
}

export interface DesktopBridge {
  getFilePath?(file: File): string;
  consumeLaunchFiles(): Promise<string[]>;
  onOpenFiles(callback: (filePaths: string[]) => void): () => void;
  readFile(filePath: string): Promise<DesktopFileSnapshot>;
  statFile?(filePath: string): Promise<{ lastModified: number }>;
  writeFile(filePath: string, bytes: Uint8Array): Promise<{ lastModified: number }>;
}

export interface DesktopFileSystemFileHandle extends FileSystemFileHandle {
  readonly desktopPath?: string;
}

function basenameOfPath(filePath: string): string {
  const parts = filePath.split(/[/\\]/);
  return parts[parts.length - 1] || filePath;
}

async function toUint8Array(data: unknown): Promise<Uint8Array> {
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }
  if (data instanceof Blob) {
    return new Uint8Array(await data.arrayBuffer());
  }
  if (typeof data === 'string') {
    return new TextEncoder().encode(data);
  }
  throw new Error('지원하지 않는 파일 쓰기 데이터 형식입니다.');
}

/**
 * Wraps a desktop file path in a standard `FileSystemFileHandle`-compatible handle so existing
 * `readFromDisk`, `changedOnDisk`, and `saveFile` work identically in Electron and browser PWAs.
 */
export function createDesktopFileHandle(
  bridge: DesktopBridge,
  filePath: string,
): FileSystemFileHandle {
  const name = basenameOfPath(filePath);
  const handle = {
    kind: 'file' as const,
    name,
    desktopPath: filePath,
    async getFile(): Promise<File> {
      const snapshot = await bridge.readFile(filePath);
      const copy = new Uint8Array(snapshot.bytes.byteLength);
      copy.set(snapshot.bytes);
      return new File([copy], snapshot.name || name, {
        lastModified: snapshot.lastModified,
      });
    },
    async queryPermission(): Promise<PermissionState> {
      return 'granted';
    },
    async requestPermission(): Promise<PermissionState> {
      return 'granted';
    },
    async createWritable(): Promise<FileSystemWritableFileStream> {
      let pending: Uint8Array = new Uint8Array(0);
      return {
        async write(data: unknown) {
          pending = await toUint8Array(data);
        },
        async close() {
          await bridge.writeFile(filePath, pending);
        },
        async abort() {
          pending = new Uint8Array(0);
        },
      } as unknown as FileSystemWritableFileStream;
    },
  };
  return handle as unknown as FileSystemFileHandle;
}

/**
 * Adapts the Electron preload bridge (`window.sejongDesktop`) to the PWA `FileLaunchQueue`
 * interface so `App.vue` can consume OS file launches through a single path.
 */
export function desktopLaunchQueue(
  bridge: DesktopBridge | undefined,
): FileLaunchQueue | undefined {
  if (!bridge) return undefined;
  return {
    setConsumer(consumer) {
      const dispatchPaths = (paths: readonly string[]) => {
        const valid = paths.filter((p) => typeof p === 'string' && p.trim().length > 0);
        if (!valid.length) return;
        consumer({
          files: valid.map((p) => createDesktopFileHandle(bridge, p)),
        });
      };

      void Promise.resolve(bridge.consumeLaunchFiles())
        .then((initial) => {
          if (Array.isArray(initial) && initial.length > 0) {
            dispatchPaths(initial);
          }
        })
        .catch(() => {
          // Ignore startup IPC errors
        });

      bridge.onOpenFiles((paths) => {
        if (Array.isArray(paths) && paths.length > 0) {
          dispatchPaths(paths);
        }
      });
    },
  };
}

function isCancelledOrDenied(err: unknown): boolean {
  return (
    err instanceof DOMException &&
    (err.name === 'AbortError' || err.name === 'NotAllowedError')
  );
}

/**
 * Receives files opened from the OS (Windows Explorer / macOS Finder) via the PWA File Handling
 * API (`window.launchQueue`) or the Electron desktop bridge. Each handle is read through
 * `readFromDisk` so Save overwrites the same file on disk and external-change detection stays armed.
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
