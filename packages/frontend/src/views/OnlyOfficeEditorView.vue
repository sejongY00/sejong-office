<script setup lang="ts">
import { nextTick, onActivated, onMounted, onUnmounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AppShell from '@/components/AppShell.vue';
import DownloadGuideModal from '@/components/DownloadGuideModal.vue';
import EditorErrorState from '@/components/EditorErrorState.vue';
import EditorToolbar from '@/components/EditorToolbar.vue';
import { fetchEditorConfig } from '@/api/client';
import { useOpenDocument } from '@/composables/useOpenDocument';
import { usePageTitle } from '@/composables/usePageTitle';
import { useSessionLifecycle } from '@/composables/useSessionLifecycle';

defineOptions({ name: 'OnlyOfficeEditorView' });

const route = useRoute();
const router = useRouter();
const error = ref<unknown>(null);
const filename = ref('문서');
const guideOpen = ref(false);
const frameHost = ref<HTMLElement | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);
let editor: { destroyEditor?: () => void } | null = null;
let scriptEl: HTMLScriptElement | null = null;
let resizeObserver: ResizeObserver | null = null;
let initialized = false;

const { openDocument } = useOpenDocument();

usePageTitle(filename);
useSessionLifecycle({ enableHeartbeat: true });

const downloadGuideSteps = [
  '편집기 좌측 상단의 파일을 누릅니다.',
  '다운로드 방법을 선택합니다.',
  '원하는 확장자를 고르면 파일이 저장됩니다.',
];

function editorHeightPx(): number {
  const host = frameHost.value;
  if (host) {
    const h = host.clientHeight;
    if (h > 200) return h;
  }
  return Math.max(400, window.innerHeight - 48);
}

function syncIframeSize() {
  const iframe = frameHost.value?.querySelector('iframe');
  if (iframe) {
    iframe.style.height = `${editorHeightPx()}px`;
    iframe.style.width = '100%';
  }
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.DocsAPI) {
      resolve();
      return;
    }
    scriptEl = document.createElement('script');
    scriptEl.src = src;
    scriptEl.async = true;
    scriptEl.onload = () => resolve();
    scriptEl.onerror = () =>
      reject(new Error('OnlyOffice 스크립트를 불러오지 못했습니다.'));
    document.head.appendChild(scriptEl);
  });
}

async function initEditor() {
  if (initialized) return;
  const docId = route.params.docId as string;
  error.value = null;
  try {
    const cfg = await fetchEditorConfig(docId);
    filename.value = String(cfg.document.title ?? '문서');
    const apiUrl = `${cfg.documentServerUrl}/web-apps/apps/api/documents/api.js`;
    await loadScript(apiUrl);
    await nextTick();

    if (!window.DocsAPI) {
      throw new Error('DocsAPI를 사용할 수 없습니다.');
    }

    const height = `${editorHeightPx()}px`;

    editor = new window.DocsAPI.DocEditor('onlyoffice-placeholder', {
      documentType: cfg.documentType,
      document: cfg.document,
      editorConfig: cfg.editorConfig,
      token: cfg.token,
      width: '100%',
      height,
      type: 'desktop',
    });
    initialized = true;

    if (frameHost.value && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => syncIframeSize());
      resizeObserver.observe(frameHost.value);
    }
  } catch (err) {
    error.value = err;
  }
}

onMounted(() => {
  void initEditor();
});

onActivated(() => {
  nextTick(() => syncIframeSize());
});

onUnmounted(() => {
  resizeObserver?.disconnect();
  resizeObserver = null;
  editor?.destroyEditor?.();
  editor = null;
  initialized = false;
});

function onOpen() {
  fileInput.value?.click();
}

function onFileSelected(e: Event) {
  const input = e.target as HTMLInputElement;
  void openDocument(input.files?.[0]);
  input.value = '';
}

function onDownload() {
  guideOpen.value = true;
}

function onClose() {
  void router.push({ name: 'home' });
}
</script>

<template>
  <AppShell :editor="true">
    <div class="editor-page">
      <EditorToolbar
        v-if="!error"
        :filename="filename"
        :show-filename="false"
        @open="onOpen"
        @save="onDownload"
        @close="onClose"
      />
      <input
        ref="fileInput"
        class="sr-only"
        type="file"
        accept=".docx,.xlsx,.pptx,.pdf,.hwp,.hwpx,.odt,.ods,.odp,.doc,.xls,.ppt,.rtf,.txt,.csv"
        @change="onFileSelected"
      />

      <EditorErrorState v-if="error" :error="error" context="onlyoffice" />
      <div v-show="!error" ref="frameHost" class="editor-frame">
        <div id="onlyoffice-placeholder" class="editor-frame__inner" />
      </div>

      <DownloadGuideModal
        :open="guideOpen"
        lead="수정한 파일은 EuroOffice 편집기 메뉴에서 받을 수 있습니다."
        :steps="downloadGuideSteps"
        path-hint="파일 → 다운로드 방법 → 확장자 선택"
        @close="guideOpen = false"
      />
    </div>
  </AppShell>
</template>

<style scoped>
.editor-page {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  background: var(--canvas);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.editor-frame {
  flex: 1 1 auto;
  min-height: 0;
  position: relative;
  width: 100%;
}

.editor-frame__inner {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.editor-frame__inner :deep(iframe),
.editor-frame :deep(iframe) {
  width: 100% !important;
  height: 100% !important;
  border: none;
}
</style>
