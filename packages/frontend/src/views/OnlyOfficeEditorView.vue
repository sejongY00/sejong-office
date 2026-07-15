<script setup lang="ts">
import { nextTick, onActivated, onMounted, onUnmounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AppShell from '@/components/AppShell.vue';
import EditorErrorState from '@/components/EditorErrorState.vue';
import { fetchEditorConfig } from '@/api/client';
import { usePageTitle } from '@/composables/usePageTitle';
import { useSessionLifecycle } from '@/composables/useSessionLifecycle';

defineOptions({ name: 'OnlyOfficeEditorView' });

const route = useRoute();
const router = useRouter();
const error = ref<unknown>(null);
const filename = ref('문서');
const frameHost = ref<HTMLElement | null>(null);
let editor: { destroyEditor?: () => void } | null = null;
let scriptEl: HTMLScriptElement | null = null;
let resizeObserver: ResizeObserver | null = null;
let initialized = false;

usePageTitle(filename);
useSessionLifecycle({ enableHeartbeat: true });

function editorHeightPx(): number {
  const host = frameHost.value;
  if (host) {
    const h = host.clientHeight;
    if (h > 200) return h;
  }
  return Math.max(400, window.innerHeight - 120);
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

function goHome() {
  void router.push({ name: 'home' });
}
</script>

<template>
  <AppShell :compact-footer="true">
    <div class="editor-page">
      <header v-if="!error" class="bar">
        <button type="button" class="bar__btn bar__btn--ghost" @click="goHome">
          ← 홈
        </button>
        <div class="bar__meta">
          <strong>{{ filename }}</strong>
          <span>
            서버에 영구 저장되지 않습니다. 닫기 전에 다운로드하세요.
            <em>파일 → 저장</em>
          </span>
        </div>
      </header>

      <EditorErrorState v-if="error" :error="error" context="onlyoffice" />
      <div v-show="!error" ref="frameHost" class="editor-frame">
        <div id="onlyoffice-placeholder" class="editor-frame__inner" />
      </div>
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

.bar {
  flex: 0 0 auto;
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
  padding: 0.65rem 1rem;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
  z-index: 2;
}

.bar__meta {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 12rem;
}

.bar__meta strong {
  font-size: 0.95rem;
}

.bar__meta span {
  font-size: 0.75rem;
  color: var(--muted);
}

.bar__meta em {
  font-style: normal;
  font-weight: 600;
  color: var(--accent);
  white-space: nowrap;
}

.bar__btn {
  border: none;
  padding: 0.5rem 0.95rem;
  border-radius: 3px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
}

.bar__btn--ghost {
  background: transparent;
  color: var(--ink);
  border: 1px solid var(--border);
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
