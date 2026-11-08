<script setup lang="ts">
import { nextTick, onActivated, onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { createEditor, type RhwpEditor } from '@rhwp/editor';
import AppShell from '@/components/AppShell.vue';
import DownloadGuideModal from '@/components/DownloadGuideModal.vue';
import EditorErrorState from '@/components/EditorErrorState.vue';
import EditorToolbar from '@/components/EditorToolbar.vue';
import { AppError } from '@/utils/appError';
import { isHwp } from '@/config/app';
import { usePageTitle } from '@/composables/usePageTitle';
import {
  clearHwpFile,
  hwpOpenToken,
  loadHwpFile,
  storeHwpFile,
} from '@/composables/useSessionLifecycle';

defineOptions({ name: 'RhwpEditorView' });

const router = useRouter();
const error = ref<unknown>(null);
const filename = ref('문서.hwp');
const guideOpen = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);
let editor: RhwpEditor | null = null;
let loadedToken = '';
let loadSeq = 0;

usePageTitle(filename);

const downloadGuideSteps = [
  '편집기 메뉴에서 파일을 누릅니다.',
  '저장 또는 다른 이름으로 저장을 선택합니다.',
  '원하는 위치와 이름으로 저장합니다.',
];

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
  fileInput.value?.click();
}

async function onFileSelected(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;

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

async function onDownload() {
  guideOpen.value = true;
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
        @save="onDownload"
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

      <DownloadGuideModal
        :open="guideOpen"
        lead="수정한 한글 문서는 rhwp 편집기 메뉴에서 받을 수 있습니다."
        :steps="downloadGuideSteps"
        path-hint="파일 → 저장(다른 이름으로 저장)"
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

.editor-frame :deep(iframe) {
  width: 100% !important;
  height: 100% !important;
  border: none;
}
</style>
