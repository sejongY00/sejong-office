<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import AppShell from '@/components/AppShell.vue';
import EditorErrorState from '@/components/EditorErrorState.vue';
import EditorToolbar from '@/components/EditorToolbar.vue';
import { OFFICE_EDITOR_URL } from '@/config/app';
import { consumeOfficeDocument } from '@/composables/officeSession';
import { useOpenDocument } from '@/composables/useOpenDocument';
import { usePageTitle } from '@/composables/usePageTitle';
import { AppError } from '@/utils/appError';

defineOptions({ name: 'OfficeEditorView' });

// The editor runs entirely in its own iframe (OnlyOffice editors + x2t WASM); this page only hands
// it the bytes and asks for them back. Protocol: ranuts/document docs/embed-api.md.
// This only works while neither page sends COOP/COEP: an isolated parent blocks the non-COEP
// editor frame, and an editor sending COEP breaks under a non-isolated parent.

const router = useRouter();
const doc = consumeOfficeDocument();
// Reload or direct link: the file only lived in memory, so there is nothing to open.
const error = ref<unknown>(doc ? null : new AppError('no_document'));
const filename = ref(doc?.name ?? '문서');
const saving = ref(false);
const frame = ref<HTMLIFrameElement | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);

const { openDocument } = useOpenDocument();
usePageTitle(filename);

const editorOrigin = new URL(OFFICE_EDITOR_URL).origin;
const frameSrc = (() => {
  const url = new URL('editor', OFFICE_EDITOR_URL);
  url.searchParams.set('embed', '1');
  url.searchParams.set('locale', 'ko');
  // Pin the parent origin from the start instead of trusting the first message.
  url.searchParams.set('embedOrigin', window.location.origin);
  return url.toString();
})();

let seq = 0;
let openId = '';
let pendingSaveId = '';
let probeTimer: ReturnType<typeof setInterval> | undefined;

function send(type: string, payload: Record<string, unknown> = {}): string {
  const id = `${Date.now()}-${(seq += 1)}`;
  frame.value?.contentWindow?.postMessage({ id, type, payload }, editorOrigin);
  return id;
}

function download(file: Blob, name: string) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function onMessage(event: MessageEvent) {
  if (event.origin !== editorOrigin || event.source !== frame.value?.contentWindow) return;
  const { id, type, payload } = (event.data ?? {}) as {
    id?: string;
    type?: string;
    payload?: Record<string, unknown>;
  };
  if (!type?.startsWith('document:')) return;

  switch (type) {
    case 'document:ready':
    case 'document:state':
      openStagedDocument();
      break;
    case 'document:saved':
      if (id === pendingSaveId) {
        saving.value = false;
        pendingSaveId = '';
        const file = payload?.file as File | undefined;
        if (file) download(file, String(payload?.fileName ?? file.name ?? filename.value));
      }
      break;
    case 'document:error': {
      const message = String(payload?.message ?? '편집기 오류');
      if (id && id === pendingSaveId) {
        // Keep the editor (and the user's edits) on screen; only the export failed.
        saving.value = false;
        pendingSaveId = '';
        window.alert(`저장하지 못했습니다: ${message}`);
      } else if (id && id === openId) {
        error.value = new AppError('editor_error', message);
      }
      break;
    }
  }
}

/** Open the staged bytes exactly once, as soon as the editor answers. */
function openStagedDocument() {
  if (!doc || openId) return;
  stopProbe();
  // Copy: postMessage may detach the buffer.
  openId = send('document:open-buffer', { fileName: doc.name, buffer: doc.buffer.slice(0), readonly: false });
}

// ranuts posts `document:ready` on its window `load`, which its lazily loaded editor bundle can
// miss. So after the iframe loads, ask for the state until the editor answers.
function onFrameLoad() {
  if (!doc || openId) return;
  stopProbe();
  let tries = 0;
  probeTimer = setInterval(() => {
    tries += 1;
    if (tries > 120) {
      stopProbe();
      error.value = new AppError('editor_error', '편집기가 응답하지 않습니다. 네트워크를 확인하고 다시 열어 주세요.');
      return;
    }
    send('document:get-state');
  }, 500);
}

function stopProbe() {
  if (probeTimer) clearInterval(probeTimer);
  probeTimer = undefined;
}

onMounted(() => {
  if (doc) window.addEventListener('message', onMessage);
});

onUnmounted(() => {
  stopProbe();
  window.removeEventListener('message', onMessage);
});

function onSave() {
  if (saving.value) return;
  saving.value = true;
  pendingSaveId = send('document:save');
}

function onOpen() {
  fileInput.value?.click();
}

function onFileSelected(e: Event) {
  const input = e.target as HTMLInputElement;
  void openDocument(input.files?.[0]);
  input.value = '';
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
        :busy="saving"
        @open="onOpen"
        @save="onSave"
        @close="onClose"
      />
      <input
        ref="fileInput"
        class="sr-only"
        type="file"
        accept=".docx,.xlsx,.pptx,.pdf,.hwp,.hwpx,.odt,.ods,.odp,.doc,.xls,.ppt,.rtf,.txt,.csv"
        @change="onFileSelected"
      />

      <EditorErrorState v-if="error" :error="error" context="office" />
      <div v-else class="editor-frame">
        <iframe
          ref="frame"
          class="editor-frame__inner"
          :src="frameSrc"
          title="오피스 편집기"
          allow="clipboard-read; clipboard-write; fullscreen"
          @load="onFrameLoad"
        />
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
  border: none;
}
</style>
