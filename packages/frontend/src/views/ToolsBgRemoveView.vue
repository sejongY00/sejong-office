<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import AppShell from '@/components/AppShell.vue';
import EditorToolbar from '@/components/EditorToolbar.vue';
import { useFileDropZone } from '@/composables/useFileDropZone';
import { usePageTitle } from '@/composables/usePageTitle';
import {
  DEFAULT_BG_REMOVE_OPTIONS,
  removeBackgroundBySample,
  type BgRemoveMode,
  type Rgb,
} from '@/integrations/bgremove/removeBg';
import { downloadBlob } from '@/utils/downloadBlob';

defineOptions({ name: 'ToolsBgRemoveView' });

const router = useRouter();
const fileInput = ref<HTMLInputElement | null>(null);
const filename = ref('배경 제거');
const sourceUrl = ref<string | null>(null);
const resultUrl = ref<string | null>(null);
const background = ref<Rgb | null>(null);
const busy = ref(false);
const error = ref('');
const notice = ref('');
const tolerance = ref(DEFAULT_BG_REMOVE_OPTIONS.tolerance);
const feather = ref(DEFAULT_BG_REMOVE_OPTIONS.feather);
const mode = ref<BgRemoveMode>(DEFAULT_BG_REMOVE_OPTIONS.mode);
const imageUrlInput = ref('');

usePageTitle(filename, { faviconKind: 'bgremove' });

const hasImage = computed(() => Boolean(sourceUrl.value));
const bgCss = computed(() => {
  if (!background.value) return '';
  const { r, g, b } = background.value;
  return `rgb(${r}, ${g}, ${b})`;
});

function revoke(url: string | null) {
  if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
}

function baseName(name = filename.value) {
  return name.replace(/\.[^.]+$/, '') || 'logo';
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
  revoke(sourceUrl.value);
  revoke(resultUrl.value);
  sourceUrl.value = URL.createObjectURL(file);
  resultUrl.value = null;
  background.value = null;
  filename.value = file.name;
  await processImage();
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
  notice.value = '';
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

async function processImage() {
  if (!sourceUrl.value) return;
  busy.value = true;
  error.value = '';
  try {
    const result = await removeBackgroundBySample(sourceUrl.value, {
      tolerance: tolerance.value,
      feather: feather.value,
      mode: mode.value,
    });
    revoke(resultUrl.value);
    resultUrl.value = result.url;
    background.value = result.background;
    notice.value = '배경을 제거했습니다.';
  } catch (reason) {
    error.value =
      reason instanceof Error ? reason.message : '배경 제거에 실패했습니다.';
  } finally {
    busy.value = false;
  }
}

function exportPng() {
  if (!resultUrl.value) return;
  void fetch(resultUrl.value)
    .then((response) => response.blob())
    .then((blob) => downloadBlob(blob, `${baseName()}-transparent.png`));
}

watch(mode, () => {
  if (sourceUrl.value) void processImage();
});

onBeforeUnmount(() => {
  revoke(sourceUrl.value);
  revoke(resultUrl.value);
});
</script>

<template>
  <AppShell :editor="true">
    <div
      class="bg-page"
      :class="{ 'is-drop-active': dropActive }"
      @dragenter="onDragEnter"
      @dragover="onDragOver"
      @dragleave="onDragLeave"
      @drop="onZoneDrop"
    >
      <EditorToolbar
        :filename="filename"
        :show-save="Boolean(resultUrl)"
        :busy="busy"
        @open="onOpen"
        @save="exportPng"
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
          <strong>배경 제거</strong>
          <p>
            단색 배경 로고 이미지를 열거나 끌어다 놓으면 모서리 색을 기준으로
            배경을 투명하게 만듭니다. 흰 배경·검은 배경 모두 처리됩니다.
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
              placeholder="https://example.com/logo.png"
              :disabled="busy"
              aria-label="이미지 URL"
            />
            <button type="submit" :disabled="busy">URL 불러오기</button>
          </form>
        </div>

        <template v-else>
          <div class="controls">
            <form class="url-form url-form--inline" @submit.prevent="void loadFromUrl()">
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
            <label class="field field--mode">
              <span>모드</span>
              <select v-model="mode" :disabled="busy">
                <option value="threshold">전체 유사색 (글자 구멍 포함)</option>
                <option value="flood">바깥만 (모서리 연결)</option>
              </select>
            </label>
            <label class="field">
              <span class="field__row">
                허용치
                <em>{{ tolerance }}</em>
              </span>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                :value="tolerance"
                :disabled="busy"
                @input="
                  tolerance = Number(($event.target as HTMLInputElement).value)
                "
                @change="void processImage()"
              />
            </label>
            <label class="field">
              <span class="field__row">
                가장자리
                <em>{{ feather }}</em>
              </span>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                :value="feather"
                :disabled="busy"
                @input="
                  feather = Number(($event.target as HTMLInputElement).value)
                "
                @change="void processImage()"
              />
            </label>
            <div v-if="background" class="swatch" title="추정 배경색">
              <span class="swatch__chip" :style="{ background: bgCss }" />
              <span>배경 {{ bgCss }}</span>
            </div>
            <button
              type="button"
              class="btn-primary"
              :disabled="busy || !resultUrl"
              @click="exportPng"
            >
              PNG 저장
            </button>
          </div>

          <div class="panes">
            <section class="pane">
              <h2>원본</h2>
              <div class="frame">
                <img :src="sourceUrl!" alt="원본" />
              </div>
            </section>
            <section class="pane">
              <h2>결과</h2>
              <div class="frame frame--checker">
                <img v-if="resultUrl" :src="resultUrl" alt="배경 제거 결과" />
                <p v-else class="muted">처리 중…</p>
              </div>
            </section>
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
.bg-page {
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

.btn-primary {
  min-height: 2.5rem;
  border: 1px solid var(--accent);
  border-radius: 4px;
  padding: 0.4rem 0.9rem;
  background: var(--accent-soft);
  color: var(--ink);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
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
  margin-top: 0.25rem;
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

.url-form--inline {
  width: auto;
  flex: 1 1 16rem;
  margin-top: 0;
  align-items: end;
}

.url-form--inline input {
  min-height: 2.25rem;
}

.url-form--inline button {
  min-height: 2.25rem;
}

.controls {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  gap: 0.75rem 1rem;
  margin-bottom: 0.85rem;
  padding: 0.65rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
}

.field {
  display: grid;
  gap: 0.3rem;
  min-width: 10rem;
  flex: 1 1 12rem;
  font-size: 0.86rem;
}

.field--mode {
  flex: 0 1 16rem;
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
.field input[type='range'] {
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

.swatch {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-height: 2.25rem;
  font-size: 0.8rem;
  color: var(--muted);
}

.swatch__chip {
  width: 1.1rem;
  height: 1.1rem;
  border-radius: 3px;
  border: 1px solid var(--border);
}

.panes {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.85rem;
  align-items: start;
}

.pane {
  min-width: 0;
  overflow: auto;
}

.pane h2 {
  margin: 0 0 0.45rem;
  font-size: 0.9rem;
}

.frame {
  display: inline-block;
  width: fit-content;
  max-width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
  overflow: auto;
  vertical-align: top;
  line-height: 0;
}

.frame--checker {
  background-color: #c8c8c8;
  background-image:
    linear-gradient(45deg, #efefef 25%, transparent 25%),
    linear-gradient(-45deg, #efefef 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #efefef 75%),
    linear-gradient(-45deg, transparent 75%, #efefef 75%);
  background-size: 20px 20px;
  background-position:
    0 0,
    0 10px,
    10px -10px,
    -10px 0;
}

.frame img {
  display: block;
  width: auto;
  height: auto;
  max-width: none;
  max-height: none;
}

.muted {
  margin: 0;
  color: var(--muted);
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
  .panes {
    grid-template-columns: 1fr;
  }

  .controls {
    align-items: stretch;
  }

  .controls .btn-primary {
    width: 100%;
  }
}
</style>
