<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import AppShell from '@/components/AppShell.vue';
import EditorErrorState from '@/components/EditorErrorState.vue';
import FileChangedBanner from '@/components/FileChangedBanner.vue';
import { useFileChangeWatch } from '@/composables/useFileChangeWatch';
import { useUnsavedGuard } from '@/composables/useUnsavedGuard';
import { OFFICE_EDITOR_URL } from '@/config/app';
import { consumeOfficeDocument } from '@/composables/officeSession';
import { useOpenDocument } from '@/composables/useOpenDocument';
import { usePageTitle } from '@/composables/usePageTitle';
import { useSaveShortcut } from '@/composables/useSaveShortcut';
import { AppError } from '@/utils/appError';
import { saveFile } from '@/utils/fileAccess';
import { withTimeout } from '@/utils/withTimeout';

defineOptions({ name: 'OfficeEditorView' });

// Large files take a while to convert back, so this is generous; it only catches a dead frame.
const SAVE_TIMEOUT_MS = 60_000;

// The editor runs entirely in its own iframe (OnlyOffice editors + x2t WASM); this page only hands
// it the bytes and asks for them back. Protocol: ranuts/document docs/embed-api.md.
// This only works while neither page sends COOP/COEP: an isolated parent blocks the non-COEP
// editor frame, and an editor sending COEP breaks under a non-isolated parent.

const router = useRouter();
const doc = consumeOfficeDocument();
// Reload or direct link: the file only lived in memory, so there is nothing to open.
const error = ref<unknown>(doc ? null : new AppError('no_document'));
const filename = ref(doc?.name ?? '문서');
// The opened file on disk; Save overwrites it. Null (new document, other browsers) = ask or download.
let fileHandle = doc?.handle ?? null;

// Unsaved edits, as reported by the editor (it also clears this when we export for Save).
let dirty = false;
// Opening a file remounts this page under a new key, so the guard never needs re-arming here.
useUnsavedGuard(() => dirty);

// Reload stays on this route (only the query changes), which the leave guard doesn't see; the
// banner already warned that unsaved edits are dropped.
const { changed: diskChanged, reloadFromDisk, keepMine } = useFileChangeWatch(
  () => fileHandle,
  (file) => void openDocument(file),
);
const saving = ref(false);
// The editor frame stays blank for 10-25 s while it downloads the OnlyOffice stack; cover it until
// the document is actually on screen.
const opened = ref(false);
const frame = ref<HTMLIFrameElement | null>(null);

const { openDocument } = useOpenDocument();
usePageTitle(filename);
useSaveShortcut(() => void onSave());

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
let pendingSave: { resolve: (file: Blob) => void; reject: (err: Error) => void } | null = null;
let probeTimer: ReturnType<typeof setInterval> | undefined;

function send(type: string, payload: Record<string, unknown> = {}): string {
  const id = `${Date.now()}-${(seq += 1)}`;
  frame.value?.contentWindow?.postMessage({ id, type, payload }, editorOrigin);
  return id;
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
    case 'document:opened':
      opened.value = true;
      break;
    case 'document:dirty-changed':
      dirty = payload?.dirty === true;
      break;
    case 'document:save-requested':
      void onSave();
      break;
    case 'document:close-requested':
      onClose();
      break;
    case 'document:saved':
      if (id === pendingSaveId) {
        pendingSaveId = '';
        const file = payload?.file as File | undefined;
        if (file) pendingSave?.resolve(file);
        else pendingSave?.reject(new Error('편집기가 파일을 돌려주지 않았습니다.'));
        pendingSave = null;
      }
      break;
    case 'document:error': {
      const message = String(payload?.message ?? '편집기 오류');
      if (id && id === pendingSaveId) {
        // Keep the editor (and the user's edits) on screen; only the export failed.
        pendingSaveId = '';
        pendingSave?.reject(new Error(message));
        pendingSave = null;
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

/**
 * Ask the editor for the current bytes (in the opened file's own format). Gives up after
 * SAVE_TIMEOUT_MS so a frame that never answers can't leave Save stuck; a late answer is ignored.
 */
function exportFromEditor(): Promise<Blob> {
  const exported = new Promise<Blob>((resolve, reject) => {
    pendingSave = { resolve, reject };
    pendingSaveId = send('document:save');
  });
  const id = pendingSaveId;
  return withTimeout(
    exported,
    SAVE_TIMEOUT_MS,
    '편집기가 응답하지 않아 저장하지 못했습니다. 잠시 후 다시 저장해 주세요.',
  ).finally(() => {
    if (pendingSaveId === id) {
      pendingSaveId = '';
      pendingSave = null;
    }
  });
}

async function onSave() {
  if (saving.value) return;
  saving.value = true;
  try {
    const written = await saveFile({ suggestedName: filename.value, handle: fileHandle }, exportFromEditor);
    if (written) {
      fileHandle = written;
      filename.value = written.name;
    }
  } catch (err) {
    // The editor may already count the export as saved; the file on disk wasn't written.
    dirty = true;
    window.alert(`저장하지 못했습니다: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    saving.value = false;
  }
}

function onClose() {
  void router.push({ name: 'home' });
}
</script>

<template>
  <AppShell :editor="true">
    <div class="editor-page">
      <FileChangedBanner v-if="diskChanged" @reload="reloadFromDisk" @keep="keepMine" />

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
        <div v-if="!opened" class="editor-loading" role="status" aria-live="polite">
          <span>편집기를 불러오는 중…</span>
          <progress />
        </div>
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

.editor-loading {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  background: var(--canvas);
  color: var(--ink);
  font-size: 0.85rem;
}

.editor-loading progress {
  width: min(16rem, calc(100% - 2rem));
  accent-color: var(--accent);
}
</style>
