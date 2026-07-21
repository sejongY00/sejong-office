<script setup lang="ts">
import {
  nextTick,
  onActivated,
  onMounted,
  onUnmounted,
  ref,
  watch,
} from 'vue';
import { useRouter } from 'vue-router';
import AppShell from '@/components/AppShell.vue';
import EditorToolbar from '@/components/EditorToolbar.vue';
import { consumeDiagramFile } from '@/composables/diagramSession';
import { usePageTitle } from '@/composables/usePageTitle';
import { useSystemTheme } from '@/composables/useSystemTheme';
import {
  mountExcalidraw,
  type ExcalidrawController,
} from '@/integrations/excalidraw/ExcalidrawHost';
import { downloadBlob, downloadText } from '@/utils/downloadBlob';

defineOptions({ name: 'ExcalidrawEditorView' });

const router = useRouter();
const host = ref<HTMLElement | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);
const filename = ref('새그림.excalidraw');
const busy = ref(false);
const error = ref('');
const theme = useSystemTheme();
let controller: ExcalidrawController | null = null;

usePageTitle(filename);

function baseName(): string {
  return filename.value.replace(/\.excalidraw$/i, '') || '새그림';
}

async function run(task: () => Promise<void>) {
  if (busy.value) return;
  busy.value = true;
  error.value = '';
  try {
    await task();
  } catch (err) {
    error.value =
      err instanceof Error ? err.message : '작업을 완료하지 못했습니다.';
  } finally {
    busy.value = false;
  }
}

onMounted(() => {
  if (!host.value) return;
  controller = mountExcalidraw(host.value, theme.value);
  const pending = consumeDiagramFile('excalidraw');
  if (pending) {
    void run(async () => {
      if (!controller) throw new Error('편집기가 아직 준비되지 않았습니다.');
      await controller.load(pending);
      filename.value = pending.name;
    });
  }
});

onActivated(() => {
  void nextTick(() => controller?.refresh());
});

onUnmounted(() => {
  controller?.destroy();
  controller = null;
});

watch(theme, (value) => {
  void controller?.setTheme(value);
});

function onOpen() {
  fileInput.value?.click();
}

function onFileSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  if (!file.name.toLowerCase().endsWith('.excalidraw')) {
    error.value = '.excalidraw 파일을 선택해 주세요.';
    return;
  }
  void run(async () => {
    if (!controller) throw new Error('편집기가 아직 준비되지 않았습니다.');
    await controller.load(file);
    filename.value = file.name;
  });
}

function onSave() {
  void run(async () => {
    if (!controller) throw new Error('편집기가 아직 준비되지 않았습니다.');
    downloadText(
      await controller.serialize(),
      filename.value,
      'application/vnd.excalidraw+json',
    );
  });
}

function onExportSvg() {
  void run(async () => {
    if (!controller) throw new Error('편집기가 아직 준비되지 않았습니다.');
    downloadText(
      await controller.exportSvg(),
      `${baseName()}.svg`,
      'image/svg+xml;charset=utf-8',
    );
  });
}

function onExportPng() {
  void run(async () => {
    if (!controller) throw new Error('편집기가 아직 준비되지 않았습니다.');
    downloadBlob(await controller.exportPng(), `${baseName()}.png`);
  });
}

function onClose() {
  void router.push({ name: 'home' });
}
</script>

<template>
  <AppShell :editor="true">
    <div class="editor-page">
      <EditorToolbar
        :filename="filename"
        save-label="원본 저장"
        :show-export-actions="true"
        :busy="busy"
        @open="onOpen"
        @save="onSave"
        @export-svg="onExportSvg"
        @export-png="onExportPng"
        @close="onClose"
      />
      <input
        ref="fileInput"
        class="sr-only"
        type="file"
        accept=".excalidraw,application/vnd.excalidraw+json"
        @change="onFileSelected"
      />
      <p v-if="error" class="editor-error" role="alert">{{ error }}</p>
      <div ref="host" class="excalidraw-host" />
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

.excalidraw-host {
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
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
</style>
