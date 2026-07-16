<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { createEditor, type RhwpEditor } from '@rhwp/editor';
import AppShell from '@/components/AppShell.vue';
import EditorErrorState from '@/components/EditorErrorState.vue';
import EditorToolbar from '@/components/EditorToolbar.vue';
import { ApiError } from '@/api/client';
import { extensionOf, isHwp } from '@/config/app';
import { usePageTitle } from '@/composables/usePageTitle';
import {
  clearHwpFile,
  loadHwpFile,
  storeHwpFile,
  useSessionLifecycle,
} from '@/composables/useSessionLifecycle';
import { downloadBlob } from '@/utils/downloadBlob';

defineOptions({ name: 'RhwpEditorView' });

const router = useRouter();
const error = ref<unknown>(null);
const filename = ref('문서.hwp');
const fileInput = ref<HTMLInputElement | null>(null);
let editor: RhwpEditor | null = null;
let initialized = false;

usePageTitle(filename);
useSessionLifecycle({ enableHeartbeat: true });

onMounted(async () => {
  if (initialized) return;

  const stored = loadHwpFile();
  if (!stored) {
    error.value = new ApiError(
      404,
      'not_found',
      '열린 HWP 파일이 없습니다. 홈에서 다시 업로드해 주세요.',
    );
    return;
  }

  filename.value = stored.name;
  error.value = null;

  try {
    editor = await createEditor('#rhwp-host', {
      width: '100%',
      height: '100%',
    });
    await editor.loadFile(stored.buffer, stored.name);
    initialized = true;
  } catch (err) {
    error.value = err;
  }
});

onUnmounted(() => {
  editor?.destroy();
  editor = null;
  initialized = false;
});

function onOpen() {
  fileInput.value?.click();
}

async function onFileSelected(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file || !editor) return;

  if (!isHwp(file.name)) {
    error.value = new ApiError(
      400,
      'unsupported_type',
      'HWP/HWPX 파일만 열 수 있습니다.',
    );
    return;
  }

  try {
    await storeHwpFile(file);
    const stored = loadHwpFile();
    if (!stored) throw new Error('파일을 읽을 수 없습니다.');
    await editor.loadFile(stored.buffer, stored.name);
    filename.value = stored.name;
    error.value = null;
  } catch (err) {
    error.value = err;
  }
}

async function onSave() {
  if (!editor) return;
  try {
    const ext = extensionOf(filename.value);
    const bytes =
      ext === 'hwpx' ? await editor.exportHwpx() : await editor.exportHwp();
    const name =
      ext === 'hwpx' || ext === 'hwp'
        ? filename.value
        : `${filename.value}.hwp`;
    downloadBlob(bytes, name);
  } catch (err) {
    error.value = err;
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
        @open="onOpen"
        @save="onSave"
        @close="onClose"
      />
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
