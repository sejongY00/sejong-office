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
import mermaid from 'mermaid';
import AppShell from '@/components/AppShell.vue';
import EditorToolbar from '@/components/EditorToolbar.vue';
import { consumeDiagramFile } from '@/composables/diagramSession';
import { usePageTitle } from '@/composables/usePageTitle';
import { useSystemTheme } from '@/composables/useSystemTheme';
import {
  downloadBlob,
  downloadText,
  readTextFile,
  svgToPngBlob,
} from '@/utils/downloadBlob';

defineOptions({ name: 'MermaidEditorView' });

const DEFAULT_CODE = `flowchart TD
  Start[시작] --> Decision{결정}
  Decision -->|예| Done[완료]
  Decision -->|아니요| Start`;

const router = useRouter();
const fileInput = ref<HTMLInputElement | null>(null);
const filename = ref('새다이어그램.mmd');
const code = ref(DEFAULT_CODE);
const renderedSvg = ref('');
const renderError = ref('');
const actionError = ref('');
const busy = ref(false);
const theme = useSystemTheme();
let renderTimer: number | null = null;
let renderVersion = 0;

usePageTitle(filename);

function baseName(): string {
  return filename.value.replace(/\.(?:mmd|mermaid)$/i, '') || '새다이어그램';
}

function errorMessage(error: unknown): string {
  if (!(error instanceof Error)) return '다이어그램을 렌더링하지 못했습니다.';
  return error.message.split('\n').slice(0, 4).join('\n');
}

async function renderDiagram() {
  const version = ++renderVersion;
  try {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: theme.value === 'dark' ? 'dark' : 'default',
      fontFamily: 'IBM Plex Sans KR, sans-serif',
      htmlLabels: false,
    });
    await mermaid.parse(code.value);
    const id = `mermaid-preview-${version}`;
    const result = await mermaid.render(id, code.value);
    if (version !== renderVersion) return;
    renderedSvg.value = result.svg;
    renderError.value = '';
  } catch (error) {
    if (version !== renderVersion) return;
    renderError.value = errorMessage(error);
  }
}

function scheduleRender() {
  if (renderTimer !== null) window.clearTimeout(renderTimer);
  renderTimer = window.setTimeout(() => {
    renderTimer = null;
    void renderDiagram();
  }, 250);
}

watch([code, theme], scheduleRender, { immediate: true });

onMounted(() => {
  const pending = consumeDiagramFile('mermaid');
  if (!pending) return;
  void run(async () => {
    code.value = await readTextFile(pending);
    filename.value = pending.name.replace(/\.mermaid$/i, '.mmd');
    await renderDiagram();
  });
});

onActivated(() => {
  void nextTick(renderDiagram);
});

onUnmounted(() => {
  if (renderTimer !== null) window.clearTimeout(renderTimer);
  renderVersion += 1;
});

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

function onOpen() {
  fileInput.value?.click();
}

function onFileSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  if (!/\.(?:mmd|mermaid)$/i.test(file.name)) {
    actionError.value = '.mmd 또는 .mermaid 파일을 선택해 주세요.';
    return;
  }
  void run(async () => {
    code.value = await readTextFile(file);
    filename.value = file.name.replace(/\.mermaid$/i, '.mmd');
    await renderDiagram();
  });
}

function onSave() {
  downloadText(code.value, filename.value, 'text/plain;charset=utf-8');
}

function ensureSvg(): string {
  if (renderError.value || !renderedSvg.value) {
    throw new Error('구문 오류를 수정한 후 내보내 주세요.');
  }
  return renderedSvg.value;
}

function onExportSvg() {
  void run(async () => {
    downloadText(
      ensureSvg(),
      `${baseName()}.svg`,
      'image/svg+xml;charset=utf-8',
    );
  });
}

function onExportPng() {
  void run(async () => {
    downloadBlob(
      await svgToPngBlob(ensureSvg()),
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
        accept=".mmd,.mermaid,text/plain"
        @change="onFileSelected"
      />
      <p v-if="actionError" class="editor-error" role="alert">
        {{ actionError }}
      </p>

      <div class="mermaid-editor">
        <section class="source-pane" aria-label="Mermaid 코드 편집">
          <textarea
            v-model="code"
            class="source"
            spellcheck="false"
            aria-label="Mermaid 코드"
          />
        </section>
        <section class="preview-pane" aria-label="Mermaid 미리보기">
          <pre v-if="renderError" class="render-error">{{ renderError }}</pre>
          <div v-else class="preview" v-html="renderedSvg" />
        </section>
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

.mermaid-editor {
  flex: 1 1 auto;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(18rem, 0.85fr) minmax(0, 1.4fr);
  gap: 1px;
  background: var(--border);
}

.source-pane,
.preview-pane {
  min-width: 0;
  min-height: 0;
  background: var(--surface);
}

.source {
  display: block;
  width: 100%;
  height: 100%;
  resize: none;
  border: 0;
  outline: 0;
  padding: 1rem;
  background: var(--surface);
  color: var(--ink);
  font: 0.9rem/1.55 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  tab-size: 2;
}

.preview-pane {
  overflow: auto;
  padding: 1.25rem;
}

.preview {
  min-width: min-content;
  min-height: 100%;
  display: grid;
  place-items: center;
}

.preview :deep(svg) {
  display: block;
  max-width: 100%;
  height: auto;
}

.render-error {
  margin: 0;
  padding: 1rem;
  border: 1px solid color-mix(in srgb, var(--danger) 35%, var(--border));
  border-radius: 6px;
  background: color-mix(in srgb, var(--danger) 8%, var(--surface));
  color: var(--danger);
  white-space: pre-wrap;
  font: 0.82rem/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
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

@media (max-width: 760px) {
  .mermaid-editor {
    grid-template-columns: 1fr;
    grid-template-rows: minmax(14rem, 0.8fr) minmax(14rem, 1fr);
  }
}
</style>
