/// <reference types="vite/client" />

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

interface Window {
  EXCALIDRAW_ASSET_PATH?: string;
  launchQueue?: LaunchQueue;
}
