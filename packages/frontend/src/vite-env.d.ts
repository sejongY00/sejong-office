/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_OFFICE_EDITOR_URL?: string;
}

declare module '@rhwp/editor' {
  export type RhwpEditor = {
    loadFile: (
      data: ArrayBuffer | Uint8Array,
      fileName?: string,
    ) => Promise<{ pageCount: number }>;
    pageCount: () => Promise<number>;
    getPageSvg: (page?: number) => Promise<string>;
    exportHwp: () => Promise<Uint8Array>;
    exportHwpx: () => Promise<Uint8Array>;
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

interface Window {
  EXCALIDRAW_ASSET_PATH?: string;
}
