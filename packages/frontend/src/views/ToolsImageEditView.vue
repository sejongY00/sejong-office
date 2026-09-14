<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import AppShell from '@/components/AppShell.vue';
import EditorToolbar from '@/components/EditorToolbar.vue';
import CropEditor from '@/components/imageedit/CropEditor.vue';
import { useFileDropZone } from '@/composables/useFileDropZone';
import { usePageTitle } from '@/composables/usePageTitle';
import {
  exportEditedImage,
  extensionForFormat,
  formatBytes,
  fullImageCrop,
  loadImageFromUrl,
  maxCropForAspect,
  previewOutputSize,
  type ExportFormat,
  type PixelRect,
  type RatioFit,
} from '@/integrations/imageedit/process';
import { downloadBlob } from '@/utils/downloadBlob';

defineOptions({ name: 'ToolsImageEditView' });

const RATIO_PRESETS = [
  { id: 'free', label: '자유', aspect: null as number | null },
  { id: 'orig', label: '원본', aspect: -1 },
  { id: '1:1', label: '1:1', aspect: 1 },
  { id: '4:3', label: '4:3', aspect: 4 / 3 },
  { id: '3:2', label: '3:2', aspect: 3 / 2 },
  { id: '16:9', label: '16:9', aspect: 16 / 9 },
  { id: '3:4', label: '3:4', aspect: 3 / 4 },
  { id: '9:16', label: '9:16', aspect: 9 / 16 },
] as const;

const MAX_EDGE_PRESETS = [
  { id: '', label: '제한 없음' },
  { id: '1920', label: '긴 변 1920px' },
  { id: '1280', label: '긴 변 1280px' },
  { id: '800', label: '긴 변 800px' },
] as const;

const router = useRouter();
const fileInput = ref<HTMLInputElement | null>(null);
const filename = ref('이미지 편집');
const sourceUrl = ref<string | null>(null);
const sourceSize = ref(0);
const imageWidth = ref(0);
const imageHeight = ref(0);
const loadedImage = ref<HTMLImageElement | null>(null);
const crop = ref<PixelRect>({ x: 0, y: 0, width: 1, height: 1 });
const ratioId = ref<(typeof RATIO_PRESETS)[number]['id']>('free');
const fit = ref<RatioFit>('crop');
const scalePercent = ref(100);
const maxEdgeId = ref('');
const format = ref<ExportFormat>('image/jpeg');
const quality = ref(80);
const padColor = ref('#ffffff');
const busy = ref(false);
const error = ref('');
const notice = ref('');
const imageUrlInput = ref('');
const estimateBytes = ref<number | null>(null);
const estimateBusy = ref(false);

usePageTitle(filename, { faviconKind: 'imgedit' });

const hasImage = computed(() => Boolean(sourceUrl.value && loadedImage.value));

const originalAspect = computed(() =>
  imageHeight.value ? imageWidth.value / imageHeight.value : 1,
);

const cropAspect = computed(() => {
  const preset = RATIO_PRESETS.find((item) => item.id === ratioId.value);
  if (!preset || preset.id === 'free') return null;
  if (preset.id === 'orig') return originalAspect.value;
  return preset.aspect;
});

const maxEdge = computed(() => {
  const n = Number(maxEdgeId.value);
  return n > 0 ? n : null;
});

const outputHint = computed(() =>
  previewOutputSize({
    crop: crop.value,
    scale: scalePercent.value / 100,
    maxEdge: maxEdge.value,
    padAspect: cropAspect.value,
    fit: fit.value,
  }),
);

const qualityDisabled = computed(() => format.value === 'image/png');

function revoke(url: string | null) {
  if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
}

function baseName(name = filename.value) {
  return name.replace(/\.[^.]+$/, '') || 'image';
}

function onClose() {
  void router.push({ name: 'home' });
}

function onOpen() {
  fileInput.value?.click();
}

function isImageFile(file: File) {
  if (file.type.startsWith('image/')) return true;
  return /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(file.name);
}

async function loadFile(file: File) {
  if (!isImageFile(file)) {
    error.value = 'PNG, JPEG, WebP, GIF, BMP, SVG 이미지를 선택해 주세요.';
    return;
  }
  error.value = '';
  notice.value = '';
  estimateBytes.value = null;
  const url = URL.createObjectURL(file);
  try {
    const image = await loadImageFromUrl(url);
    revoke(sourceUrl.value);
    sourceUrl.value = url;
    loadedImage.value = image;
    sourceSize.value = file.size;
    filename.value = file.name;
    imageWidth.value = image.naturalWidth || image.width;
    imageHeight.value = image.naturalHeight || image.height;
    ratioId.value = 'free';
    fit.value = 'crop';
    scalePercent.value = 100;
    maxEdgeId.value = '';
    crop.value = fullImageCrop(imageWidth.value, imageHeight.value);
    notice.value = `${imageWidth.value}×${imageHeight.value} · ${formatBytes(file.size)}`;
  } catch (reason) {
    revoke(url);
    error.value =
      reason instanceof Error ? reason.message : '이미지를 열지 못했습니다.';
  }
}

async function loadFromUrl(raw = imageUrlInput.value) {
  const trimmed = raw.trim();
  if (!trimmed) {
    error.value = '이미지 URL을 입력해 주세요.';
    return;
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    error.value = '올바른 이미지 URL을 입력해 주세요.';
    return;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    error.value = 'http(s) URL만 사용할 수 있습니다.';
    return;
  }

  busy.value = true;
  error.value = '';
  try {
    const response = await fetch(parsed.href, { mode: 'cors' });
    if (!response.ok) {
      throw new Error(`이미지를 가져오지 못했습니다 (${response.status}).`);
    }
    const blob = await response.blob();
    const looksImage =
      blob.type.startsWith('image/') ||
      /\.(png|jpe?g|webp|gif|bmp|svg)(\?|$)/i.test(parsed.pathname);
    if (!looksImage) {
      throw new Error('응답이 이미지가 아닙니다.');
    }
    const leaf = decodeURIComponent(
      parsed.pathname.split('/').filter(Boolean).pop() || 'image',
    );
    const name = /\.[a-z0-9]+$/i.test(leaf) ? leaf : `${leaf}.png`;
    const file = new File([blob], name, {
      type: blob.type || 'image/png',
    });
    imageUrlInput.value = parsed.href;
    await loadFile(file);
  } catch (reason) {
    const message =
      reason instanceof Error ? reason.message : 'URL에서 이미지를 불러오지 못했습니다.';
    error.value = /Failed to fetch|NetworkError|CORS/i.test(message)
      ? '이미지를 가져오지 못했습니다. CORS를 허용하는 URL인지 확인해 주세요.'
      : message;
  } finally {
    busy.value = false;
  }
}

function onFilesSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (file) void loadFile(file);
}

const {
  dropActive,
  onDragEnter,
  onDragOver,
  onDragLeave,
  onDrop: onZoneDrop,
} = useFileDropZone((files) => {
  const file = files[0];
  if (file) void loadFile(file);
});

function resetCrop() {
  if (!imageWidth.value) return;
  if (fit.value === 'crop' && cropAspect.value) {
    crop.value = maxCropForAspect(
      imageWidth.value,
      imageHeight.value,
      cropAspect.value,
    );
  } else {
    crop.value = fullImageCrop(imageWidth.value, imageHeight.value);
  }
}

watch(ratioId, () => {
  if (!hasImage.value) return;
  if (fit.value === 'crop' && cropAspect.value) {
    const center = {
      x: crop.value.x + crop.value.width / 2,
      y: crop.value.y + crop.value.height / 2,
    };
    crop.value = maxCropForAspect(
      imageWidth.value,
      imageHeight.value,
      cropAspect.value,
      center,
    );
  }
});

watch(fit, (next) => {
  if (next === 'crop' && cropAspect.value && hasImage.value) {
    crop.value = maxCropForAspect(
      imageWidth.value,
      imageHeight.value,
      cropAspect.value,
      {
        x: crop.value.x + crop.value.width / 2,
        y: crop.value.y + crop.value.height / 2,
      },
    );
  }
});

let estimateTimer = 0;
let estimateGen = 0;

watch(
  [
    crop,
    scalePercent,
    maxEdgeId,
    format,
    quality,
    fit,
    ratioId,
    padColor,
    loadedImage,
  ],
  () => {
    window.clearTimeout(estimateTimer);
    if (!loadedImage.value) {
      estimateBytes.value = null;
      return;
    }
    estimateTimer = window.setTimeout(() => {
      void refreshEstimate();
    }, 350);
  },
  { deep: true },
);

async function refreshEstimate() {
  const image = loadedImage.value;
  if (!image) return;
  const gen = ++estimateGen;
  estimateBusy.value = true;
  try {
    const result = await exportEditedImage({
      image,
      crop: crop.value,
      scale: scalePercent.value / 100,
      maxEdge: maxEdge.value,
      format: format.value,
      quality: quality.value / 100,
      fit: fit.value,
      padAspect: cropAspect.value,
      padColor: padColor.value,
    });
    if (gen !== estimateGen) return;
    estimateBytes.value = result.blob.size;
  } catch {
    if (gen !== estimateGen) return;
    estimateBytes.value = null;
  } finally {
    if (gen === estimateGen) estimateBusy.value = false;
  }
}

async function saveImage() {
  const image = loadedImage.value;
  if (!image) return;
  busy.value = true;
  error.value = '';
  try {
    const result = await exportEditedImage({
      image,
      crop: crop.value,
      scale: scalePercent.value / 100,
      maxEdge: maxEdge.value,
      format: format.value,
      quality: quality.value / 100,
      fit: fit.value,
      padAspect: cropAspect.value,
      padColor: padColor.value,
    });
    const ext = extensionForFormat(format.value);
    downloadBlob(result.blob, `${baseName()}-edited.${ext}`);
    notice.value = `${result.width}×${result.height} · ${formatBytes(result.blob.size)} 저장`;
  } catch (reason) {
    error.value =
      reason instanceof Error ? reason.message : '이미지를 저장하지 못했습니다.';
  } finally {
    busy.value = false;
  }
}

onBeforeUnmount(() => {
  window.clearTimeout(estimateTimer);
  estimateGen += 1;
  revoke(sourceUrl.value);
});
</script>

<template>
  <AppShell :editor="true">
    <div
      class="edit-page"
      :class="{ 'is-drop-active': dropActive }"
      @dragenter="onDragEnter"
      @dragover="onDragOver"
      @dragleave="onDragLeave"
      @drop="onZoneDrop"
    >
      <EditorToolbar
        :filename="filename"
        :show-save="hasImage"
        save-label="다운로드"
        :busy="busy"
        @open="onOpen"
        @save="void saveImage()"
        @close="onClose"
      />
      <input
        ref="fileInput"
        class="sr-only"
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/bmp,image/svg+xml,.png,.jpg,.jpeg,.webp,.gif,.bmp,.svg"
        @change="onFilesSelected"
      />

      <p v-if="error" class="viewer-message viewer-message--error" role="alert">
        {{ error }}
      </p>
      <p v-else-if="notice" class="viewer-message">{{ notice }}</p>

      <main class="workspace">
        <div
          v-if="!hasImage"
          class="empty"
          :class="{ 'is-drop-active': dropActive }"
        >
          <strong>이미지 편집</strong>
          <p>
            사진을 열거나 끌어다 놓은 뒤 크롭, 축소, 경량화, 비율 변경을 적용해
            JPEG·WebP·PNG로 저장합니다. 서버에 업로드하지 않습니다.
          </p>
          <button
            type="button"
            class="btn-primary"
            :disabled="busy"
            @click="onOpen"
          >
            이미지 열기
          </button>
          <form class="url-form" @submit.prevent="void loadFromUrl()">
            <input
              v-model="imageUrlInput"
              type="url"
              inputmode="url"
              placeholder="https://example.com/photo.jpg"
              :disabled="busy"
              aria-label="이미지 URL"
            />
            <button type="submit" :disabled="busy">URL 불러오기</button>
          </form>
        </div>

        <template v-else>
          <div class="layout">
            <aside class="controls">
              <form
                class="url-form url-form--stack"
                @submit.prevent="void loadFromUrl()"
              >
                <input
                  v-model="imageUrlInput"
                  type="url"
                  inputmode="url"
                  placeholder="이미지 URL"
                  :disabled="busy"
                  aria-label="이미지 URL"
                />
                <button type="submit" :disabled="busy">URL</button>
              </form>

              <section class="group">
                <h2>크롭</h2>
                <p class="hint">
                  영역을 드래그해 자르세요. {{ crop.width }}×{{ crop.height }}px
                </p>
                <button type="button" class="btn-ghost" @click="resetCrop">
                  영역 초기화
                </button>
              </section>

              <section class="group">
                <h2>비율 변경</h2>
                <div class="chips" role="list">
                  <button
                    v-for="preset in RATIO_PRESETS"
                    :key="preset.id"
                    type="button"
                    class="chip"
                    :aria-pressed="ratioId === preset.id"
                    @click="ratioId = preset.id"
                  >
                    {{ preset.label }}
                  </button>
                </div>
                <label class="field field--inline">
                  <span>맞추는 방법</span>
                  <select v-model="fit" :disabled="!cropAspect">
                    <option value="crop">잘라내기</option>
                    <option value="pad">여백 추가</option>
                  </select>
                </label>
                <label v-if="fit === 'pad' && cropAspect" class="field field--inline">
                  <span>여백 색</span>
                  <input v-model="padColor" type="color" />
                </label>
              </section>

              <section class="group">
                <h2>축소</h2>
                <label class="field">
                  <span class="field__row">
                    배율
                    <em>{{ scalePercent }}%</em>
                  </span>
                  <input
                    v-model.number="scalePercent"
                    type="range"
                    min="10"
                    max="100"
                    step="1"
                  />
                </label>
                <label class="field field--inline">
                  <span>최대 크기</span>
                  <select v-model="maxEdgeId">
                    <option
                      v-for="preset in MAX_EDGE_PRESETS"
                      :key="preset.id"
                      :value="preset.id"
                    >
                      {{ preset.label }}
                    </option>
                  </select>
                </label>
              </section>

              <section class="group">
                <h2>경량화</h2>
                <label class="field field--inline">
                  <span>형식</span>
                  <select v-model="format">
                    <option value="image/jpeg">JPEG</option>
                    <option value="image/webp">WebP</option>
                    <option value="image/png">PNG (무손실)</option>
                  </select>
                </label>
                <label class="field">
                  <span class="field__row">
                    품질
                    <em>{{ qualityDisabled ? '해당 없음' : quality }}</em>
                  </span>
                  <input
                    v-model.number="quality"
                    type="range"
                    min="10"
                    max="100"
                    step="1"
                    :disabled="qualityDisabled"
                  />
                </label>
              </section>

              <section class="group group--stat">
                <p>
                  출력
                  <strong
                    >{{ outputHint.width }}×{{ outputHint.height }}</strong
                  >
                </p>
                <p>
                  용량
                  <strong v-if="estimateBytes != null">{{
                    formatBytes(estimateBytes)
                  }}</strong>
                  <strong v-else-if="estimateBusy">계산 중…</strong>
                  <strong v-else>—</strong>
                  <span v-if="sourceSize" class="muted">
                    / 원본 {{ formatBytes(sourceSize) }}
                  </span>
                </p>
              </section>

              <button
                type="button"
                class="btn-primary"
                :disabled="busy"
                @click="void saveImage()"
              >
                다운로드
              </button>
            </aside>

            <div class="stage">
              <CropEditor
                v-if="sourceUrl"
                :src="sourceUrl"
                :crop="crop"
                :image-width="imageWidth"
                :image-height="imageHeight"
                :aspect="fit === 'crop' ? cropAspect : null"
                @update:crop="crop = $event"
              />
            </div>
          </div>
        </template>

        <div
          v-if="dropActive && hasImage"
          class="drop-overlay"
          aria-hidden="true"
        >
          이미지를 놓아 바꾸기
        </div>
      </main>
    </div>
  </AppShell>
</template>

<style scoped>
.edit-page {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  background: var(--canvas);
}

.workspace {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 0.85rem;
}

.empty {
  height: 100%;
  min-height: min(60vh, 28rem);
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 0.75rem;
  text-align: center;
  color: var(--ink);
  border: 1px dashed transparent;
  border-radius: 6px;
  padding: 1.25rem;
}

.empty.is-drop-active {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.empty p {
  margin: 0;
  max-width: 28rem;
  color: var(--muted);
  font-size: 0.92rem;
  line-height: 1.45;
}

.layout {
  display: grid;
  grid-template-columns: minmax(16rem, 20rem) minmax(0, 1fr);
  gap: 0.85rem;
  align-items: start;
}

.controls {
  display: grid;
  gap: 0.85rem;
  padding: 0.75rem;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
}

.group {
  display: grid;
  gap: 0.45rem;
}

.group h2 {
  margin: 0;
  font-size: 0.86rem;
}

.hint,
.muted {
  margin: 0;
  color: var(--muted);
  font-size: 0.8rem;
}

.group--stat p {
  margin: 0;
  font-size: 0.86rem;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.chip {
  min-height: 2rem;
  padding: 0.2rem 0.55rem;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--canvas);
  color: var(--ink);
  font: inherit;
  font-size: 0.8rem;
  cursor: pointer;
}

.chip[aria-pressed='true'] {
  border-color: var(--accent);
  background: var(--accent-soft);
  font-weight: 650;
}

.field {
  display: grid;
  gap: 0.3rem;
  font-size: 0.86rem;
}

.field--inline {
  grid-template-columns: 5.5rem minmax(0, 1fr);
  align-items: center;
}

.field__row {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
}

.field__row em {
  font-style: normal;
  font-variant-numeric: tabular-nums;
  color: var(--muted);
}

.field select,
.field input[type='range'],
.field input[type='color'] {
  width: 100%;
  accent-color: var(--accent);
}

.field select {
  min-height: 2.25rem;
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 0.3rem 0.45rem;
  background: var(--canvas);
  color: var(--ink);
  font: inherit;
}

.field input[type='color'] {
  min-height: 2.25rem;
  padding: 0.15rem;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--canvas);
}

.btn-primary,
.btn-ghost {
  min-height: 2.5rem;
  border-radius: 4px;
  padding: 0.4rem 0.9rem;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.btn-primary {
  border: 1px solid var(--accent);
  background: var(--accent-soft);
  color: var(--ink);
}

.btn-ghost {
  justify-self: start;
  min-height: 2.1rem;
  border: 1px solid var(--border);
  background: var(--canvas);
  color: var(--ink);
  font-weight: 500;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: default;
}

.url-form {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  width: min(100%, 28rem);
}

.url-form--stack {
  width: auto;
}

.url-form input {
  flex: 1 1 12rem;
  min-height: 2.5rem;
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 0.35rem 0.55rem;
  background: var(--canvas);
  color: var(--ink);
  font: inherit;
}

.url-form button {
  min-height: 2.5rem;
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 0.35rem 0.75rem;
  background: var(--surface);
  color: var(--ink);
  font: inherit;
  cursor: pointer;
}

.url-form button:disabled {
  opacity: 0.5;
  cursor: default;
}

.stage {
  min-width: 0;
  overflow: auto;
  padding: 0.75rem;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
}

.drop-overlay {
  position: absolute;
  inset: 0.75rem;
  z-index: 20;
  display: grid;
  place-items: center;
  border: 2px dashed var(--accent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--accent-soft) 88%, transparent);
  color: var(--ink);
  font-weight: 650;
  pointer-events: none;
}

.viewer-message {
  margin: 0;
  padding: 0.45rem 0.85rem;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
  color: var(--ink);
  font-size: 0.86rem;
}

.viewer-message--error {
  color: #b42318;
  background: color-mix(in srgb, #b42318 10%, var(--surface));
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

@media (max-width: 900px) {
  .layout {
    grid-template-columns: 1fr;
  }
}
</style>
