<script setup lang="ts">
import { nextTick, onActivated, onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { createEditor, type RhwpEditor } from '@rhwp/editor';
import AppShell from '@/components/AppShell.vue';
import EditorErrorState from '@/components/EditorErrorState.vue';
import FileChangedBanner from '@/components/FileChangedBanner.vue';
import { useFileChangeWatch } from '@/composables/useFileChangeWatch';
import { useUnsavedGuard } from '@/composables/useUnsavedGuard';
import { AppError } from '@/utils/appError';
import { extensionOf, isHwp, RHWP_STUDIO_URL } from '@/config/app';
import { saveFile } from '@/utils/fileAccess';
import { usePageTitle, type DocumentSaveStatus } from '@/composables/usePageTitle';
import { useSaveShortcut } from '@/composables/useSaveShortcut';
import {
  clearHwpFile,
  hwpFileHandle,
  hwpOpenToken,
  setHwpFileHandle,
  loadHwpFile,
  storeHwpFile,
} from '@/composables/useSessionLifecycle';

defineOptions({ name: 'RhwpEditorView' });

const router = useRouter();
const error = ref<unknown>(null);
const filename = ref('문서.hwp');
const saving = ref(false);
const saveStatus = ref<DocumentSaveStatus>('pristine');
const saveError = ref('');
let editor: RhwpEditor | null = null;
let loadedToken = '';
let loadSeq = 0;
// Unsaved edits. The studio can only be asked, so the guard refreshes this periodically.
let dirty = false;
const { confirmDiscard } = useUnsavedGuard(
  () => dirty,
  async () => {
    const nextDirty = editor ? (await editor.getDocumentState()).dirty : false;
    dirty = nextDirty;
    if (nextDirty) {
      saveStatus.value = 'modified';
    }
  },
);

const { changed: diskChanged, reloadFromDisk, keepMine } = useFileChangeWatch(
  hwpFileHandle,
  async (file) => {
    // The banner already warned that unsaved edits are dropped; clear the editor's dirty flag so
    // it doesn't ask again (its own "save" there would download instead of writing the file).
    await editor?.notifySaved(file.name).catch(() => undefined);
    dirty = false;
    saveStatus.value = 'pristine';
    await openFile(file);
  },
);

usePageTitle(filename, { status: saveStatus });
useSaveShortcut(() => void onSave());

const studioOrigin = new URL(RHWP_STUDIO_URL, window.location.href).origin;

function onStudioMessage(event: MessageEvent) {
  if (event.origin !== studioOrigin || event.source !== editor?.element.contentWindow) return;
  const data = event.data as { type?: string; status?: DocumentSaveStatus } | null;
  if (data?.type === 'rhwp:save-requested') {
    void onSave();
  } else if (data?.type === 'rhwp:close-requested') {
    void onClose();
  } else if (data?.type === 'rhwp:save-status-changed') {
    if (data.status === 'modified') {
      dirty = true;
      saveStatus.value = 'modified';
    } else if (data.status === 'saved') {
      dirty = false;
      saveStatus.value = 'saved';
    } else if (data.status === 'pristine') {
      dirty = false;
      saveStatus.value = 'pristine';
    }
  }
}

async function bootstrapFromStore() {
  const seq = ++loadSeq;
  const token = hwpOpenToken();
  const stored = loadHwpFile();

  if (!stored) {
    error.value = new AppError(
      'not_found',
      '열린 HWP 파일이 없습니다. 홈에서 다시 업로드해 주세요.',
    );
    return;
  }

  // Same staged file already shown (e.g. mounted + activated).
  if (editor && loadedToken === token && loadedToken !== '0') {
    filename.value = stored.name;
    error.value = null;
    return;
  }

  filename.value = stored.name;
  error.value = null;

  try {
    await nextTick();
    if (seq !== loadSeq) return;

    if (!editor) {
      editor = await createEditor('#rhwp-host', {
        studioUrl: RHWP_STUDIO_URL,
        width: '100%',
        height: '100%',
      });
    }
    if (seq !== loadSeq) return;

    await editor.loadFile(stored.buffer, stored.name);
    if (seq !== loadSeq) return;

    loadedToken = token;
    dirty = false;
    saveStatus.value = 'pristine';
    saveError.value = '';
  } catch (err) {
    if (seq !== loadSeq) return;
    error.value = err;
  }
}

onMounted(() => {
  window.addEventListener('message', onStudioMessage);
  void bootstrapFromStore();
});

onActivated(() => {
  void bootstrapFromStore();
});

onUnmounted(() => {
  window.removeEventListener('message', onStudioMessage);
  loadSeq += 1;
  editor?.destroy();
  editor = null;
  loadedToken = '';
});

async function openFile(file: File) {
  if (!isHwp(file.name)) {
    error.value = new AppError(
      'unsupported_type',
      'HWP/HWPX 파일만 열 수 있습니다.',
    );
    return;
  }

  try {
    await storeHwpFile(file);
    // Token bump remounts via App viewKey; also reload in place if not remounted.
    loadedToken = '';
    await bootstrapFromStore();
  } catch (err) {
    error.value = err;
  }
}

async function onSave() {
  if (saving.value || !editor) return;
  const current = editor;
  saving.value = true;
  saveError.value = '';
  try {
    const written = await saveFile(
      { suggestedName: filename.value, handle: hwpFileHandle() },
      async () => {
        // Save in the opened file's own format; a new document is .hwpx.
        const bytes =
          extensionOf(filename.value) === 'hwp'
            ? await current.exportHwp()
            : await current.exportHwpx();
        return new Blob([bytes.slice()]);
      },
    );
    if (written) {
      setHwpFileHandle(written);
      filename.value = written.name;
    }
    // Clears the studio's unsaved-changes guard and updates its top title to "- 저장됨".
    await current.notifySaved(filename.value).catch(() => undefined);
    dirty = false;
    saveStatus.value = 'saved';
  } catch (err) {
    saveError.value = `저장하지 못했습니다: ${err instanceof Error ? err.message : String(err)}`;
  } finally {
    saving.value = false;
  }
}

async function onClose() {
  // Ask before clearing the stored file, so "keep editing" really keeps it.
  if (!(await confirmDiscard())) return;
  clearHwpFile();
  void router.push({ name: 'home' });
}
</script>

<template>
  <AppShell :editor="true">
    <div class="editor-page">
      <FileChangedBanner v-if="diskChanged" @reload="reloadFromDisk" @keep="keepMine" />
      <p v-if="saveError" class="editor-error" role="alert">{{ saveError }}</p>

      <EditorErrorState v-if="error" :error="error" context="rhwp" />
      <div v-show="!error" id="rhwp-host" class="editor-frame" />
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

.editor-error {
  flex: 0 0 auto;
  margin: 0;
  padding: 0.45rem 0.75rem;
  border-bottom: 1px solid color-mix(in srgb, var(--danger) 35%, var(--border));
  background: color-mix(in srgb, var(--danger) 10%, var(--surface));
  color: var(--danger);
  font-size: 0.8rem;
}

.editor-frame {
  flex: 1 1 auto;
  min-height: 0;
  position: relative;
  width: 100%;
}

.editor-frame :deep(iframe) {
  width: 100% !important;
  height: 100% !important;
  border: none;
}
</style>
