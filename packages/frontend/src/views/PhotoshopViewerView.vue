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
import AppShell from '@/components/AppShell.vue';
import EditorToolbar from '@/components/EditorToolbar.vue';
import { useFileDropZone } from '@/composables/useFileDropZone';
import { consumeViewerFiles } from '@/composables/viewerSession';
import { usePageTitle } from '@/composables/usePageTitle';
import {
  drawPsdToCanvas,
  isPsdFile,
  openPsd,
  PSD_INCOMPATIBLE_MESSAGE,
  type OpenedPsd,
} from '@/integrations/photoshop/loadPsd';

defineOptions({ name: 'PhotoshopViewerView' });

const router = useRouter();
const fileInput = ref<HTMLInputElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);
const stageRef = ref<HTMLElement | null>(null);
const filename = ref('포토샵');
const error = ref('');
const notice = ref('');
const busy = ref(false);
const hasImage = ref(false);
const zoom = ref(1);
const fitZoom = ref(1);

let opened: OpenedPsd | null = null;
let renderSeq = 0;

usePageTitle(filename, { faviconKind: 'photoshop' });

const zoomLabel = computed(() => `${Math.round(zoom.value * 100)}%`);

function disposePsd() {
  renderSeq += 1;
  opened = null;
  hasImage.value = false;
}

function paint() {
  const canvas = canvasRef.value;
  if (!opened || !canvas) return;
  const seq = ++renderSeq;
  try {
    drawPsdToCanvas(opened.canvas, canvas, zoom.value);
    if (seq !== renderSeq) return;
    error.value = '';
  } catch (reason) {
    if (seq !== renderSeq) return;
    error.value =
      reason instanceof Error ? reason.message : '이미지를 그리지 못했습니다.';
  }
}

function updateFitZoom() {
  if (!opened || !stageRef.value) {
    fitZoom.value = 1;
    return;
  }
  const pad = 32;
  const availW = Math.max(120, stageRef.value.clientWidth - pad);
  const availH = Math.max(120, stageRef.value.clientHeight - pad);
  const sx = availW / opened.width;
  const sy = availH / opened.height;
  fitZoom.value = Math.max(0.1, Math.min(sx, sy, 4));
}

async function loadFile(file: File) {
  if (!isPsdFile(file)) {
    error.value = '.psd 파일을 선택해 주세요.';
    return;
  }
  busy.value = true;
  error.value = '';
  notice.value = '';
  filename.value = file.name;
  disposePsd();
  try {
    const data = await file.arrayBuffer();
    opened = openPsd(data);
    hasImage.value = true;
    await nextTick();
    updateFitZoom();
    zoom.value = fitZoom.value;
    paint();
    notice.value = `${opened.width} × ${opened.height}px`;
  } catch (reason) {
    error.value =
      reason instanceof Error ? reason.message : PSD_INCOMPATIBLE_MESSAGE;
    disposePsd();
  } finally {
    busy.value = false;
  }
}

function applyFiles(files: File[]) {
  const file = files.find((item) => isPsdFile(item));
  if (!file) {
    if (files.length) error.value = '.psd 파일을 선택해 주세요.';
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
  applyFiles(consumeViewerFiles('photoshop'));
});

onActivated(() => {
  const files = consumeViewerFiles('photoshop');
  if (files.length) applyFiles(files);
});

onBeforeUnmount(() => {
  disposePsd();
});

watch(zoom, () => {
  if (!opened) return;
  paint();
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
  zoom.value = Math.min(
    4,
    Math.max(0.1, Math.round(zoom.value * factor * 100) / 100),
  );
}

function zoomFit() {
  updateFitZoom();
  zoom.value = fitZoom.value;
}

function zoomReset() {
  zoom.value = 1;
}
</script>

<template>
  <AppShell :editor="true">
    <div
      class="psd-page"
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
        accept=".psd,image/vnd.adobe.photoshop"
        @change="onFileSelected"
      />

      <div v-if="hasImage" class="psd-controls">
        <div class="psd-controls__group">
          <button type="button" class="psd-btn" :disabled="busy" @click="zoomBy(1 / 1.25)">
            −
          </button>
          <span class="psd-controls__label">{{ zoomLabel }}</span>
          <button type="button" class="psd-btn" :disabled="busy" @click="zoomBy(1.25)">
            +
          </button>
          <button type="button" class="psd-btn" :disabled="busy" @click="zoomFit">
            맞춤
          </button>
          <button type="button" class="psd-btn" :disabled="busy" @click="zoomReset">
            100%
          </button>
        </div>
      </div>

      <p v-if="error" class="viewer-message viewer-message--error" role="alert">
        {{ error }}
      </p>
      <p v-else-if="notice" class="viewer-message">{{ notice }}</p>

      <div ref="stageRef" class="psd-stage">
        <canvas
          v-show="hasImage && !error"
          ref="canvasRef"
          class="psd-canvas"
        />
        <div v-if="!hasImage && !error && !busy" class="empty-state">
          <strong>Photoshop (.psd) 파일을 선택해 주세요.</strong>
          <span>
            RGB·Grayscale·Bitmap / 8bit .psd만 브라우저에서 볼 수 있습니다.
            파일을 열거나 이 영역으로 끌어다 놓으세요.
          </span>
          <button type="button" @click="onOpen">파일 열기</button>
        </div>
        <div v-if="dropActive" class="drop-overlay" aria-hidden="true">
          .psd 파일을 놓으세요
        </div>
      </div>
    </div>
  </AppShell>
</template>

<style scoped>
.psd-page {
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

.psd-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 0.65rem;
  padding: 0.45rem 0.85rem;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
}

.psd-controls__group {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.psd-controls__label {
  min-width: 3.5rem;
  text-align: center;
  font-size: 0.82rem;
  font-variant-numeric: tabular-nums;
  color: var(--ink-soft);
}

.psd-btn {
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

.psd-btn:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--accent) 40%, var(--border));
  background: var(--card-hover);
}

.psd-btn:disabled {
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

.psd-stage {
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
  .psd-stage {
    background-color: #1a1a1a;
    background-image:
      linear-gradient(45deg, #242424 25%, transparent 25%),
      linear-gradient(-45deg, #242424 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, #242424 75%),
      linear-gradient(-45deg, transparent 75%, #242424 75%);
  }
}

.psd-canvas {
  display: block;
  max-width: none;
  box-shadow: 0 4px 24px rgb(0 0 0 / 18%);
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

.psd-page.is-drop-active .psd-stage {
  outline: 2px dashed var(--accent);
  outline-offset: -8px;
}
</style>
