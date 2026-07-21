import { createRoot, type Root } from 'react-dom/client';
import {
  Excalidraw,
  MIME_TYPES,
  exportToBlob,
  exportToSvg,
  loadFromBlob,
  serializeAsJSON,
} from '@excalidraw/excalidraw';
import type {
  ExcalidrawImperativeAPI,
} from '@excalidraw/excalidraw/types';
import type { Theme } from '@excalidraw/excalidraw/element/types';
import '@excalidraw/excalidraw/index.css';

window.EXCALIDRAW_ASSET_PATH = '/excalidraw-assets/';

export interface ExcalidrawController {
  load(file: File): Promise<void>;
  serialize(): Promise<string>;
  exportSvg(): Promise<string>;
  exportPng(): Promise<Blob>;
  setTheme(theme: Theme): Promise<void>;
  refresh(): Promise<void>;
  destroy(): void;
}

function waitForApi(
  getApi: () => ExcalidrawImperativeAPI | null,
): Promise<ExcalidrawImperativeAPI> {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const timer = window.setInterval(() => {
      const api = getApi();
      if (api) {
        window.clearInterval(timer);
        resolve(api);
        return;
      }
      attempts += 1;
      if (attempts >= 100) {
        window.clearInterval(timer);
        reject(new Error('Excalidraw 편집기를 초기화하지 못했습니다.'));
      }
    }, 50);
  });
}

export function mountExcalidraw(
  host: HTMLElement,
  initialTheme: Theme,
): ExcalidrawController {
  let api: ExcalidrawImperativeAPI | null = null;
  let root: Root | null = createRoot(host);

  root.render(
    <Excalidraw
      excalidrawAPI={(instance) => {
        api = instance;
      }}
      langCode="ko-KR"
      theme={initialTheme}
      autoFocus
    />,
  );

  const getApi = () => waitForApi(() => api);

  return {
    async load(file) {
      const instance = await getApi();
      const restored = await loadFromBlob(
        file,
        instance.getAppState(),
        instance.getSceneElements(),
      );
      instance.updateScene({
        elements: restored.elements ?? [],
        appState: restored.appState ?? undefined,
      });
      if (restored.files) {
        instance.addFiles(Object.values(restored.files));
      }
      instance.history.clear();
      instance.scrollToContent(undefined, {
        fitToContent: true,
        animate: false,
      });
    },

    async serialize() {
      const instance = await getApi();
      return serializeAsJSON(
        instance.getSceneElements(),
        instance.getAppState(),
        instance.getFiles(),
        'local',
      );
    },

    async exportSvg() {
      const instance = await getApi();
      const svg = await exportToSvg({
        elements: instance.getSceneElements(),
        appState: {
          ...instance.getAppState(),
          exportBackground: true,
        },
        files: instance.getFiles(),
      });
      return svg.outerHTML;
    },

    async exportPng() {
      const instance = await getApi();
      const blob = await exportToBlob({
        elements: instance.getSceneElements(),
        appState: {
          ...instance.getAppState(),
          exportBackground: true,
          exportScale: 2,
        },
        files: instance.getFiles(),
        mimeType: MIME_TYPES.png,
      });
      if (!blob) {
        throw new Error('PNG 이미지를 만들 수 없습니다.');
      }
      return blob;
    },

    async setTheme(theme) {
      const instance = await getApi();
      instance.updateScene({ appState: { theme } });
    },

    async refresh() {
      const instance = await getApi();
      instance.refresh();
    },

    destroy() {
      root?.unmount();
      root = null;
      api = null;
    },
  };
}
