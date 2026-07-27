<script setup lang="ts">
import {
  computed,
  nextTick,
  onActivated,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue';
import { useRouter } from 'vue-router';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import AppShell from '@/components/AppShell.vue';
import EditorToolbar from '@/components/EditorToolbar.vue';
import { useFileDropZone } from '@/composables/useFileDropZone';
import { consumeViewerFiles } from '@/composables/viewerSession';
import { usePageTitle } from '@/composables/usePageTitle';
import {
  AI_INCOMPATIBLE_MESSAGE,
  cancelAiRender,
  isAiFile,
  isAiRenderCancelled,
  openAiAsPdf,
  renderAiPage,
} from '@/integrations/illustrator/loadAi';

defineOptions({ name: 'IllustratorViewerView' });

const router = useRouter();
const fileInput = ref<HTMLInputElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);
const stageRef = ref<HTMLElement | null>(null);
const filename = ref('일러스트');
const error = ref('');
const notice = ref('');
const busy = ref(false);
const page = ref(1);
const pageCount = ref(0);
const zoom = ref(1);
const fitZoom = ref(1);

let pdfDoc: PDFDocumentProxy | null = null;
let renderSeq = 0;

usePageTitle(filename, { faviconKind: 'illustrator' });

const pageLabel = computed(() =>
  pageCount.value > 0 ? `${page.value} / ${pageCount.value}` : '—',
);

const zoomLabel = computed(() => `${Math.round(zoom.value * 100)}%`);

async function disposePdf() {
  renderSeq += 1;
  await cancelAiRender();
  if (pdfDoc) {
    try {
      await pdfDoc.cleanup();
    } catch {
      /* ignore */
    }
    pdfDoc = null;
  }
  pageCount.value = 0;
  page.value = 1;
}

async function paint() {
  const canvas = canvasRef.value;
  if (!pdfDoc || !canvas || pageCount.value < 1) return;
  const seq = ++renderSeq;
  // Coalesce rapid page/zoom updates onto the latest request.
  await Promise.resolve();
  if (seq !== renderSeq) return;

  busy.value = true;
  try {
    await renderAiPage(pdfDoc, page.value, canvas, zoom.value);
    if (seq !== renderSeq) return;
    error.value = '';
  } catch (reason) {
    if (seq !== renderSeq || isAiRenderCancelled(reason)) return;
    error.value =
      reason instanceof Error ? reason.message : '페이지를 그리지 못했습니다.';
  } finally {
    if (seq === renderSeq) busy.value = false;
  }
}

async function updateFitZoom() {
  if (!pdfDoc || !stageRef.value) return;
  try {
    const p = await pdfDoc.getPage(page.value);
    const viewport = p.getViewport({ scale: 1 });
    p.cleanup();
    const pad = 32;
    const availW = Math.max(120, stageRef.value.clientWidth - pad);
    const availH = Math.max(120, stageRef.value.clientHeight - pad);
    const sx = availW / viewport.width;
    const sy = availH / viewport.height;
    fitZoom.value = Math.max(0.1, Math.min(sx, sy, 4));
  } catch {
    fitZoom.value = 1;
  }
}

async function loadFile(file: File) {
  if (!isAiFile(file)) {
    error.value = '.ai 파일을 선택해 주세요.';
    return;
  }
  busy.value = true;
  error.value = '';
  notice.value = '';
  filename.value = file.name;
  await disposePdf();
  try {
    const data = await file.arrayBuffer();
    pdfDoc = await openAiAsPdf(data);
    pageCount.value = pdfDoc.numPages;
    page.value = 1;
    await nextTick();
    await updateFitZoom();
    zoom.value = fitZoom.value;
    await paint();
    if (pdfDoc.numPages > 1) {
      notice.value = `아트보드(페이지) ${pdfDoc.numPages}개`;
    }
  } catch (reason) {
    error.value =
      reason instanceof Error ? reason.message : AI_INCOMPATIBLE_MESSAGE;
    await disposePdf();
  } finally {
    busy.value = false;
  }
}

function applyFiles(files: File[]) {
  const file = files.find((item) => isAiFile(item));
  if (!file) {
    if (files.length) error.value = '.ai 파일을 선택해 주세요.';
    return;
  }
  void loadFile(file);
}

const {
  dropActive,
  onDragEnter,
  onDragOver,
  onDragLeave,
  onDrop,
} = useFileDropZone(applyFiles);

onMounted(() => {
  applyFiles(consumeViewerFiles('illustrator'));
});

onActivated(() => {
  const files = consumeViewerFiles('illustrator');
  if (files.length) applyFiles(files);
});

onBeforeUnmount(() => {
  void disposePdf();
});

watch([page, zoom], () => {
  if (!pdfDoc || pageCount.value < 1) return;
  void paint();
});

function onOpen() {
  fileInput.value?.click();
}

function onFileSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files ?? []);
  input.value = '';
  if (files.length) applyFiles(files);
}

function onClose() {
  void router.push({ name: 'home' });
}

function zoomBy(factor: number) {
  zoom.value = Math.min(4, Math.max(0.1, Math.round(zoom.value * factor * 100) / 100));
}

async function zoomFit() {
  await updateFitZoom();
  zoom.value = fitZoom.value;
}

function zoomReset() {
  zoom.value = 1;
}

function prevPage() {
  if (page.value > 1) page.value -= 1;
}

function nextPage() {
  if (page.value < pageCount.value) page.value += 1;
}
</script>

<template>
  <AppShell :editor="true">
    <div
      class="ai-page"
      :class="{ 'is-drop-active': dropActive }"
      @dragenter="onDragEnter"
      @dragover="onDragOver"
      @dragleave="onDragLeave"
      @drop="onDrop"
    >
      <EditorToolbar
        :filename="filename"
        :show-save="false"
        :busy="busy"
        @open="onOpen"
        @close="onClose"
      />
      <input
        ref="fileInput"
        class="sr-only"
        type="file"
        accept=".ai,application/postscript"
        @change="onFileSelected"
      />

      <div v-if="pageCount > 0" class="ai-controls">
        <div class="ai-controls__group">
          <button
            type="button"
            class="ai-btn"
            :disabled="page <= 1 || busy"
            @click="prevPage"
          >
            이전
          </button>
          <span class="ai-controls__label">{{ pageLabel }}</span>
          <button
            type="button"
            class="ai-btn"
            :disabled="page >= pageCount || busy"
            @click="nextPage"
          >
            다음
          </button>
        </div>
        <div class="ai-controls__group">
          <button type="button" class="ai-btn" :disabled="busy" @click="zoomBy(1 / 1.25)">
            −
          </button>
          <span class="ai-controls__label">{{ zoomLabel }}</span>
          <button type="button" class="ai-btn" :disabled="busy" @click="zoomBy(1.25)">
            +
          </button>
          <button type="button" class="ai-btn" :disabled="busy" @click="zoomFit">
            맞춤
          </button>
          <button type="button" class="ai-btn" :disabled="busy" @click="zoomReset">
            100%
          </button>
        </div>
      </div>

      <p v-if="error" class="viewer-message viewer-message--error" role="alert">
        {{ error }}
      </p>
      <p v-else-if="notice" class="viewer-message">{{ notice }}</p>

      <div ref="stageRef" class="ai-stage">
        <canvas
          v-show="pageCount > 0 && !error"
          ref="canvasRef"
          class="ai-canvas"
        />
        <div v-if="!pageCount && !error && !busy" class="empty-state">
          <strong>Illustrator (.ai) 파일을 선택해 주세요.</strong>
          <span>
            PDF 호환으로 저장된 .ai만 브라우저에서 볼 수 있습니다. 파일을 열거나
            이 영역으로 끌어다 놓으세요.
          </span>
          <button type="button" @click="onOpen">파일 열기</button>
        </div>
        <div v-if="dropActive" class="drop-overlay" aria-hidden="true">
          .ai 파일을 놓으세요
        </div>
      </div>
    </div>
  </AppShell>
</template>

<style scoped>
.ai-page {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  background: var(--canvas);
  position: relative;
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

.ai-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.65rem;
  padding: 0.45rem 0.85rem;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
}

.ai-controls__group {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.ai-controls__label {
  min-width: 3.5rem;
  text-align: center;
  font-size: 0.82rem;
  font-variant-numeric: tabular-nums;
  color: var(--ink-soft);
}

.ai-btn {
  font: inherit;
  font-size: 0.8rem;
  font-weight: 600;
  padding: 0.28rem 0.65rem;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--card);
  color: var(--ink);
  cursor: pointer;
}

.ai-btn:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--accent) 40%, var(--border));
  background: var(--card-hover);
}

.ai-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.viewer-message {
  margin: 0;
  padding: 0.45rem 0.85rem;
  font-size: 0.82rem;
  color: var(--ink-soft);
  border-bottom: 1px solid var(--border);
  background: var(--surface);
}

.viewer-message--error {
  color: var(--danger);
  background: color-mix(in srgb, var(--danger) 10%, var(--surface));
}

.ai-stage {
  flex: 1;
  min-height: 0;
  position: relative;
  overflow: auto;
  display: grid;
  place-items: center;
  padding: 1rem;
  background:
    linear-gradient(45deg, #ececec 25%, transparent 25%),
    linear-gradient(-45deg, #ececec 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #ececec 75%),
    linear-gradient(-45deg, transparent 75%, #ececec 75%);
  background-size: 16px 16px;
  background-position:
    0 0,
    0 8px,
    8px -8px,
    -8px 0;
  background-color: #f7f7f7;
}

@media (prefers-color-scheme: dark) {
  .ai-stage {
    background-color: #1a1a1a;
    background-image:
      linear-gradient(45deg, #242424 25%, transparent 25%),
      linear-gradient(-45deg, #242424 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, #242424 75%),
      linear-gradient(-45deg, transparent 75%, #242424 75%);
  }
}

.ai-canvas {
  display: block;
  max-width: none;
  box-shadow: 0 4px 24px rgb(0 0 0 / 18%);
  background: #fff;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.55rem;
  max-width: 28rem;
  padding: 1.25rem 1.35rem;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--ink);
}

.empty-state strong {
  font-size: 1rem;
}

.empty-state span {
  font-size: 0.88rem;
  color: var(--muted);
  line-height: 1.45;
}

.empty-state button {
  font: inherit;
  font-size: 0.86rem;
  font-weight: 600;
  margin-top: 0.25rem;
  padding: 0.4rem 0.85rem;
  border: none;
  border-radius: 6px;
  background: var(--accent);
  color: #fff;
  cursor: pointer;
}

.drop-overlay {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: color-mix(in srgb, var(--accent) 22%, transparent);
  color: var(--ink);
  font-weight: 650;
  font-size: 1.05rem;
  pointer-events: none;
  z-index: 2;
}

.ai-page.is-drop-active .ai-stage {
  outline: 2px dashed var(--accent);
  outline-offset: -8px;
}
</style>
