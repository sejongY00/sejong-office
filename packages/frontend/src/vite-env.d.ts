/// <reference types="vite/client" />

declare const __DESKTOP_ONLY__: boolean;
declare const __APP_VERSION__: string;
declare const __APP_UPDATED_AT__: string;

interface ImportMetaEnv {
  readonly VITE_OFFICE_EDITOR_URL?: string;
  readonly VITE_RHWP_STUDIO_URL?: string;
}

declare module '@rhwp/editor' {
  export type RhwpEditor = {
    readonly element: HTMLIFrameElement;
    loadFile: (
      data: ArrayBuffer | Uint8Array,
      fileName?: string,
    ) => Promise<{ pageCount: number }>;
    pageCount: () => Promise<number>;
    getPageSvg: (page?: number) => Promise<string>;
    exportHwp: () => Promise<Uint8Array>;
    exportHwpx: () => Promise<Uint8Array>;
    notifySaved: (fileName?: string) => Promise<{ ok: true; wasDirty: boolean }>;
    getDocumentState: () => Promise<{ dirty: boolean }>;
    destroy: () => void;
  };

  export function createEditor(
    container: string | HTMLElement,
    options?: {
      studioUrl?: string;
      width?: string;
      height?: string;
    },
  ): Promise<RhwpEditor>;
}

interface LaunchParams {
  readonly targetURL?: string;
  readonly files: readonly FileSystemHandle[];
}

interface LaunchQueue {
  setConsumer(consumer: (launchParams: LaunchParams) => void): void;
}

interface SejongDesktopFileSnapshot {
  readonly path: string;
  readonly name: string;
  readonly bytes: Uint8Array;
  readonly lastModified: number;
}

interface SejongDesktopUpdateState {
  readonly status:
    | 'idle'
    | 'checking'
    | 'available'
    | 'not-available'
    | 'downloading'
    | 'downloaded'
    | 'error';
  readonly currentVersion: string;
  readonly latestVersion?: string;
  readonly percent?: number;
  readonly mode: 'auto' | 'manual-dmg';
  readonly assetName?: string;
  readonly downloadUrl?: string;
  readonly releaseUrl?: string;
  readonly downloadedPath?: string;
  readonly message?: string;
  readonly silent?: boolean;
}

interface SejongDesktopBridge {
  readonly isDesktop?: boolean;
  getFilePath?(file: File): string;
  consumeLaunchFiles(): Promise<string[]>;
  onOpenFiles(callback: (filePaths: string[]) => void): () => void;
  readFile(filePath: string): Promise<SejongDesktopFileSnapshot>;
  statFile(filePath: string): Promise<{ lastModified: number }>;
  writeFile(filePath: string, bytes: Uint8Array): Promise<{ lastModified: number }>;
  minimizeWindow?(): Promise<void>;
  toggleMaximizeWindow?(): Promise<boolean>;
  isWindowMaximized?(): Promise<boolean>;
  onWindowMaximizedChange?(callback: (maximized: boolean) => void): () => void;
  closeApp?(): Promise<void>;
  startWindowDrag?(screenX: number, screenY: number): void;
  moveWindowDrag?(screenX: number, screenY: number): void;
  endWindowDrag?(): void;
  getUpdateState?(): Promise<SejongDesktopUpdateState>;
  checkForUpdates?(): Promise<SejongDesktopUpdateState>;
  downloadUpdate?(): Promise<SejongDesktopUpdateState>;
  installUpdate?(): Promise<boolean>;
  onUpdateStateChange?(callback: (state: SejongDesktopUpdateState) => void): () => void;
}

interface Window {
  EXCALIDRAW_ASSET_PATH?: string;
  launchQueue?: LaunchQueue;
  sejongDesktop?: SejongDesktopBridge;
}
