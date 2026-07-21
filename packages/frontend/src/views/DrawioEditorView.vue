<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import AppShell from '@/components/AppShell.vue';
import EditorToolbar from '@/components/EditorToolbar.vue';
import { consumeDiagramFile } from '@/composables/diagramSession';
import {
  DRAWIO_EMBED_URL,
  useDrawioEmbed,
  type DrawioExportResult,
} from '@/composables/useDrawioEmbed';
import { usePageTitle } from '@/composables/usePageTitle';
import {
  dataUriToBlob,
  downloadBlob,
  downloadText,
  readTextFile,
} from '@/utils/downloadBlob';

defineOptions({ name: 'DrawioEditorView' });

const router = useRouter();
const iframe = ref<HTMLIFrameElement | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);
const filename = ref('새다이어그램.drawio');
const busy = ref(false);
const actionError = ref('');

usePageTitle(filename);

const { ready, error: embedError, loadXml, exportDiagram } = useDrawioEmbed(
  iframe,
  (result) => {
    void downloadUiExport(result);
  },
);

onMounted(() => {
  const pending = consumeDiagramFile('drawio');
  if (!pending) return;
  void run(async () => {
    loadXml(await readTextFile(pending), pending.name);
    filename.value = pending.name;
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

async function downloadUiExport(result: DrawioExportResult) {
  try {
    if (result.format === 'xml') {
      downloadText(
        await xmlFromResult(result),
        result.filename || filename.value,
        'application/xml;charset=utf-8',
      );
      return;
    }
    if (result.data) {
      const extension = result.format === 'svg' ? 'svg' : result.format;
      downloadBlob(
        dataUriToBlob(result.data),
        result.filename || `${baseName()}.${extension}`,
      );
    }
  } catch (error) {
    actionError.value =
      error instanceof Error ? error.message : '파일을 저장하지 못했습니다.';
  }
}

function onOpen() {
  fileInput.value?.click();
}

function onFileSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  if (!/\.(?:drawio|xml)$/i.test(file.name)) {
    actionError.value = '.drawio 또는 .xml 파일을 선택해 주세요.';
    return;
  }
  void run(async () => {
    loadXml(await readTextFile(file), file.name);
    filename.value = file.name;
  });
}

function onSave() {
  void run(async () => {
    const result = await exportDiagram('xml');
    downloadText(
      await xmlFromResult(result),
      filename.value,
      'application/xml;charset=utf-8',
    );
  });
}

function onExportSvg() {
  void run(async () => {
    downloadBlob(
      requireData(await exportDiagram('svg')),
      `${baseName()}.svg`,
    );
  });
}

function onExportPng() {
  void run(async () => {
    downloadBlob(
      requireData(await exportDiagram('png')),
      `${baseName()}.png`,
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
        save-label="원본 저장"
        :show-export-actions="true"
        :show-filename="false"
        :busy="busy || !ready"
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
