<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import AppShell from '@/components/AppShell.vue';
import EditorToolbar from '@/components/EditorToolbar.vue';
import FileChangedBanner from '@/components/FileChangedBanner.vue';
import { useFileChangeWatch } from '@/composables/useFileChangeWatch';
import { consumeDiagramFile } from '@/composables/diagramSession';
import {
  DRAWIO_EMBED_URL,
  useDrawioEmbed,
  type DrawioExportResult,
} from '@/composables/useDrawioEmbed';
import { usePageTitle, type DocumentSaveStatus } from '@/composables/usePageTitle';
import { useSaveShortcut } from '@/composables/useSaveShortcut';
import { dataUriToBlob, readTextFile } from '@/utils/downloadBlob';
import { handleOf, pickFiles, saveFile } from '@/utils/fileAccess';

defineOptions({ name: 'DrawioEditorView' });

const router = useRouter();
const iframe = ref<HTMLIFrameElement | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);
const filename = ref('새다이어그램.drawio');
const saveStatus = ref<DocumentSaveStatus>('pristine');
const busy = ref(false);
const actionError = ref('');
// The opened .drawio on disk; Save overwrites it.
let fileHandle: FileSystemFileHandle | null = null;

const { changed: diskChanged, reloadFromDisk, keepMine } = useFileChangeWatch(
  () => fileHandle,
  (file) => openFile(file),
);

usePageTitle(filename, { status: saveStatus });
useSaveShortcut(() => onSave());

const { ready, error: embedError, loadXml, exportDiagram } = useDrawioEmbed(
  iframe,
  (result) => {
    void downloadUiExport(result);
  },
  // Ctrl+S pressed inside the draw.io frame.
  (xml) => {
    void run(() => saveDiagram(async () => xml));
  },
  () => {
    saveStatus.value = 'modified';
  },
);

onMounted(() => {
  const pending = consumeDiagramFile('drawio');
  if (!pending) return;
  void run(async () => {
    loadXml(await readTextFile(pending), pending.name);
    filename.value = pending.name;
    fileHandle = handleOf(pending);
    saveStatus.value = 'pristine';
  });
});

function baseName(): string {
  return filename.value.replace(/\.(?:drawio|xml)$/i, '') || '새다이어그램';
}

async function run(task: () => Promise<void>) {
  if (busy.value) return;
  busy.value = true;
  actionError.value = '';
  try {
    await task();
  } catch (error) {
    actionError.value =
      error instanceof Error ? error.message : '작업을 완료하지 못했습니다.';
  } finally {
    busy.value = false;
  }
}

function requireData(result: DrawioExportResult): Blob {
  if (!result.data) throw new Error('draw.io 내보내기 데이터가 없습니다.');
  return dataUriToBlob(result.data);
}

async function xmlFromResult(result: DrawioExportResult): Promise<string> {
  if (result.xml) return result.xml;
  if (result.data) return dataUriToBlob(result.data).text();
  throw new Error('draw.io XML 데이터를 받지 못했습니다.');
}

/** Writes the opened diagram (keeping the handle for the next save). */
async function saveDiagram(produce: () => Promise<string>) {
  let completed = false;
  const written = await saveFile(
    {
      suggestedName: filename.value,
      handle: fileHandle,
      onSaved: () => {
        completed = true;
      },
    },
    async () => new Blob([await produce()], { type: 'application/xml;charset=utf-8' }),
  );
  if (written) {
    fileHandle = written;
    filename.value = written.name;
  }
  if (completed) {
    saveStatus.value = 'saved';
  }
}

// Save/export started from draw.io's own menu inside the frame.
async function downloadUiExport(result: DrawioExportResult) {
  try {
    if (result.format === 'xml') {
      await saveDiagram(() => xmlFromResult(result));
      return;
    }
    if (result.data) {
      const extension = result.format === 'svg' ? 'svg' : result.format;
      await saveFile(
        { suggestedName: result.filename || `${baseName()}.${extension}` },
        () => requireData(result),
      );
    }
  } catch (error) {
    actionError.value =
      error instanceof Error ? error.message : '파일을 저장하지 못했습니다.';
  }
}

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
  if (!/\.(?:drawio|xml)$/i.test(file.name)) {
    actionError.value = '.drawio 또는 .xml 파일을 선택해 주세요.';
    return;
  }
  void run(async () => {
    loadXml(await readTextFile(file), file.name);
    filename.value = file.name;
    fileHandle = handleOf(file);
    saveStatus.value = 'pristine';
  });
}

function onSave() {
  void run(() => saveDiagram(async () => xmlFromResult(await exportDiagram('xml'))));
}

function onExportSvg() {
  void run(async () => {
    await saveFile({ suggestedName: `${baseName()}.svg` }, async () =>
      requireData(await exportDiagram('svg')),
    );
  });
}

function onExportPng() {
  void run(async () => {
    await saveFile({ suggestedName: `${baseName()}.png` }, async () =>
      requireData(await exportDiagram('png')),
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
        :save-status="saveStatus"
        save-label="저장"
        :show-export-actions="true"
        :show-filename="true"
        :busy="busy || !ready"
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
        accept=".drawio,.xml,application/xml,text/xml"
        @change="onFileSelected"
      />
      <p v-if="actionError || embedError" class="editor-error" role="alert">
        {{ actionError || embedError }}
      </p>
      <iframe
        ref="iframe"
        class="drawio-frame"
        :src="DRAWIO_EMBED_URL"
        title="draw.io 다이어그램 편집기"
        allow="clipboard-read; clipboard-write"
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

.drawio-frame {
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
  border: 0;
  background: var(--surface);
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
