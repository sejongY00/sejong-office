<script setup lang="ts">
import { nextTick, onActivated, onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { createEditor, type RhwpEditor } from '@rhwp/editor';
import AppShell from '@/components/AppShell.vue';
import EditorErrorState from '@/components/EditorErrorState.vue';
import EditorToolbar from '@/components/EditorToolbar.vue';
import FileChangedBanner from '@/components/FileChangedBanner.vue';
import { useFileChangeWatch } from '@/composables/useFileChangeWatch';
import { AppError } from '@/utils/appError';
import { extensionOf, isHwp } from '@/config/app';
import { pickFiles, saveFile } from '@/utils/fileAccess';
import { usePageTitle } from '@/composables/usePageTitle';
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
const fileInput = ref<HTMLInputElement | null>(null);
let editor: RhwpEditor | null = null;
let loadedToken = '';
let loadSeq = 0;

const { changed: diskChanged, reloadFromDisk, keepMine } = useFileChangeWatch(
  hwpFileHandle,
  async (file) => {
    // The banner already warned that unsaved edits are dropped; clear the editor's dirty flag so
    // it doesn't ask again (its own "save" there would download instead of writing the file).
    await editor?.notifySaved(file.name).catch(() => undefined);
    await openFile(file);
  },
);

usePageTitle(filename);

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
        width: '100%',
        height: '100%',
      });
    }
    if (seq !== loadSeq) return;

    await editor.loadFile(stored.buffer, stored.name);
    if (seq !== loadSeq) return;

    loadedToken = token;
  } catch (err) {
    if (seq !== loadSeq) return;
    error.value = err;
  }
}

onMounted(() => {
  void bootstrapFromStore();
});

onActivated(() => {
  void bootstrapFromStore();
});

onUnmounted(() => {
  loadSeq += 1;
  editor?.destroy();
  editor = null;
  loadedToken = '';
});

function onOpen() {
  void pickFiles(fileInput.value, (files) => void openFile(files[0]));
}

function onFileSelected(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (file) void openFile(file);
}

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
      // Clears the studio's unsaved-changes guard; older studios lack it, which is harmless.
      await current.notifySaved(written.name).catch(() => undefined);
    }
  } catch (err) {
    window.alert(`저장하지 못했습니다: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    saving.value = false;
  }
}

function onClose() {
  clearHwpFile();
  void router.push({ name: 'home' });
}
</script>

<template>
  <AppShell :editor="true">
    <div class="editor-page">
      <EditorToolbar
        v-if="!error"
        :filename="filename"
        save-label="저장"
        :busy="saving"
        @open="onOpen"
        @save="onSave"
        @close="onClose"
      />
      <FileChangedBanner v-if="diskChanged" @reload="reloadFromDisk" @keep="keepMine" />
      <input
        ref="fileInput"
        class="sr-only"
        type="file"
        accept=".hwp,.hwpx"
        @change="onFileSelected"
      />

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

.editor-frame :deep(iframe) {
  width: 100% !important;
  height: 100% !important;
  border: none;
}
</style>
