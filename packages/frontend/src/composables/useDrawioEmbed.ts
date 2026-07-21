import {
  onMounted,
  onUnmounted,
  ref,
  type Ref,
} from 'vue';

const DRAWIO_ORIGIN = 'https://embed.diagrams.net';
const EXPORT_TIMEOUT_MS = 20_000;

export const DRAWIO_EMBED_URL =
  `${DRAWIO_ORIGIN}/?embed=1&proto=json&spin=1&libraries=1` +
  '&ui=min&noSaveBtn=1&noExitBtn=1&saveAndExit=0';

export const EMPTY_DRAWIO_XML =
  '<mxfile host="embed.diagrams.net">' +
  '<diagram id="page-1" name="Page-1">' +
  '<mxGraphModel dx="1200" dy="800" grid="1" gridSize="10" guides="1" ' +
  'tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" ' +
  'pageWidth="827" pageHeight="1169" math="0" shadow="0">' +
  '<root><mxCell id="0"/><mxCell id="1" parent="0"/></root>' +
  '</mxGraphModel></diagram></mxfile>';

export interface DrawioExportResult {
  format: string;
  data?: string;
  xml?: string;
  filename?: string;
}

interface PendingExport {
  format: string;
  resolve: (result: DrawioExportResult) => void;
  reject: (error: Error) => void;
  timer: number;
}

export function useDrawioEmbed(
  iframe: Ref<HTMLIFrameElement | null>,
  onUiExport?: (result: DrawioExportResult) => void,
) {
  const ready = ref(false);
  const error = ref('');
  let currentXml = EMPTY_DRAWIO_XML;
  let currentTitle = '새다이어그램.drawio';
  let pending: PendingExport | null = null;
  let initTimer: number | null = null;

  function post(message: Record<string, unknown>) {
    const target = iframe.value?.contentWindow;
    if (!target) throw new Error('draw.io 편집기가 준비되지 않았습니다.');
    target.postMessage(JSON.stringify(message), DRAWIO_ORIGIN);
  }

  function sendLoad() {
    post({
      action: 'load',
      xml: currentXml,
      title: currentTitle,
      autosave: 1,
      exportProtocol: true,
      noSaveBtn: 1,
      noExitBtn: 1,
      saveAndExit: 0,
    });
  }

  function parseMessage(data: unknown): Record<string, unknown> | null {
    if (typeof data === 'object' && data !== null) {
      return data as Record<string, unknown>;
    }
    if (typeof data !== 'string') return null;
    try {
      return JSON.parse(data) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  function onMessage(event: MessageEvent) {
    if (
      event.origin !== DRAWIO_ORIGIN ||
      event.source !== iframe.value?.contentWindow
    ) {
      return;
    }

    const message = parseMessage(event.data);
    if (!message || typeof message.event !== 'string') return;

    if (message.event === 'init') {
      ready.value = true;
      error.value = '';
      if (initTimer !== null) {
        window.clearTimeout(initTimer);
        initTimer = null;
      }
      sendLoad();
      return;
    }

    if (
      (message.event === 'autosave' || message.event === 'save') &&
      typeof message.xml === 'string'
    ) {
      currentXml = message.xml;
      return;
    }

    if (message.event === 'export') {
      const result: DrawioExportResult = {
        format:
          typeof message.format === 'string' ? message.format : 'unknown',
        data: typeof message.data === 'string' ? message.data : undefined,
        xml: typeof message.xml === 'string' ? message.xml : undefined,
        filename:
          typeof message.filename === 'string' ? message.filename : undefined,
      };
      if (result.xml) currentXml = result.xml;

      if (pending) {
        const active = pending;
        pending = null;
        window.clearTimeout(active.timer);
        active.resolve(result);
      } else {
        onUiExport?.(result);
      }
    }
  }

  function loadXml(xml: string, title: string) {
    currentXml = xml;
    currentTitle = title;
    error.value = '';
    if (ready.value) sendLoad();
  }

  function exportDiagram(format: 'xml' | 'svg' | 'png') {
    return new Promise<DrawioExportResult>((resolve, reject) => {
      if (!ready.value) {
        reject(new Error('draw.io 편집기가 아직 준비되지 않았습니다.'));
        return;
      }
      if (pending) {
        reject(new Error('다른 내보내기 작업이 진행 중입니다.'));
        return;
      }

      const timer = window.setTimeout(() => {
        if (!pending) return;
        pending = null;
        reject(new Error('draw.io 내보내기 응답 시간이 초과되었습니다.'));
      }, EXPORT_TIMEOUT_MS);
      pending = { format, resolve, reject, timer };

      try {
        post({ action: 'export', format });
      } catch (err) {
        window.clearTimeout(timer);
        pending = null;
        reject(
          err instanceof Error ? err : new Error('내보내기에 실패했습니다.'),
        );
      }
    });
  }

  onMounted(() => {
    window.addEventListener('message', onMessage);
    initTimer = window.setTimeout(() => {
      if (ready.value) return;
      error.value =
        'draw.io 편집기를 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.';
    }, EXPORT_TIMEOUT_MS);
  });

  onUnmounted(() => {
    window.removeEventListener('message', onMessage);
    if (initTimer !== null) window.clearTimeout(initTimer);
    if (pending) {
      window.clearTimeout(pending.timer);
      pending.reject(new Error('편집기가 닫혔습니다.'));
      pending = null;
    }
  });

  return {
    ready,
    error,
    loadXml,
    exportDiagram,
  };
}
