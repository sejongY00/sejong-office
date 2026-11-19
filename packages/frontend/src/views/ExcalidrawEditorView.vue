<script setup lang="ts">
import {
  computed,
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
import FileChangedBanner from '@/components/FileChangedBanner.vue';
import { useFileChangeWatch } from '@/composables/useFileChangeWatch';
import { consumeDiagramFile } from '@/composables/diagramSession';
import { usePageTitle } from '@/composables/usePageTitle';
import { useSaveShortcut } from '@/composables/useSaveShortcut';
import { useSystemTheme } from '@/composables/useSystemTheme';
import {
  mountExcalidraw,
  type ExcalidrawController,
} from '@/integrations/excalidraw/ExcalidrawHost';
import {
  loadThemePreference,
  saveThemePreference,
  type CanvasTheme,
} from '@/integrations/excalidraw/themePreference';
import { handleOf, pickFiles, saveFile } from '@/utils/fileAccess';

defineOptions({ name: 'ExcalidrawEditorView' });

const router = useRouter();
const host = ref<HTMLElement | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);
const filename = ref('새그림.excalidraw');
const busy = ref(false);
const error = ref('');
const systemTheme = useSystemTheme();
// Picked in Excalidraw's menu and remembered; null = follow the system theme.
const chosenTheme = ref<CanvasTheme | null>(loadThemePreference());
const theme = computed(() => chosenTheme.value ?? systemTheme.value);
let controller: ExcalidrawController | null = null;
// The opened .excalidraw on disk; Save overwrites it.
let fileHandle: FileSystemFileHandle | null = null;

const { changed: diskChanged, reloadFromDisk, keepMine } = useFileChangeWatch(
  () => fileHandle,
  (file) => openFile(file),
);

usePageTitle(filename);
useSaveShortcut(() => onSave());

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
  controller = mountExcalidraw(host.value, theme.value, (picked) => {
    chosenTheme.value = picked;
    saveThemePreference(picked);
  });
  const pending = consumeDiagramFile('excalidraw');
  if (pending) {
    void run(async () => {
      if (!controller) throw new Error('편집기가 아직 준비되지 않았습니다.');
      await controller.load(pending);
      filename.value = pending.name;
      fileHandle = handleOf(pending);
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
  void pickFiles(fileInput.value, (files) => openFile(files[0]));
}

function onFileSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (file) openFile(file);
}

function openFile(file: File) {
  if (!file.name.toLowerCase().endsWith('.excalidraw')) {
    error.value = '.excalidraw 파일을 선택해 주세요.';
    return;
  }
  void run(async () => {
    if (!controller) throw new Error('편집기가 아직 준비되지 않았습니다.');
    await controller.load(file);
    filename.value = file.name;
    fileHandle = handleOf(file);
  });
}

function requireController(): ExcalidrawController {
  if (!controller) throw new Error('편집기가 아직 준비되지 않았습니다.');
  return controller;
}

function onSave() {
  void run(async () => {
    const written = await saveFile(
      { suggestedName: filename.value, handle: fileHandle },
      async () =>
        new Blob([await requireController().serialize()], {
          type: 'application/vnd.excalidraw+json',
        }),
    );
    if (written) {
      fileHandle = written;
      filename.value = written.name;
    }
  });
}

function onExportSvg() {
  void run(async () => {
    await saveFile(
      { suggestedName: `${baseName()}.svg` },
      async () =>
        new Blob([await requireController().exportSvg()], {
          type: 'image/svg+xml;charset=utf-8',
        }),
    );
  });
}

function onExportPng() {
  void run(async () => {
    await saveFile({ suggestedName: `${baseName()}.png` }, () =>
      requireController().exportPng(),
    );
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
        save-label="저장"
        :show-export-actions="true"
        :busy="busy"
        @open="onOpen"
        @save="onSave"
        @export-svg="onExportSvg"
        @export-png="onExportPng"
        @close="onClose"
      />
      <FileChangedBanner v-if="diskChanged" @reload="reloadFromDisk" @keep="keepMine" />
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
