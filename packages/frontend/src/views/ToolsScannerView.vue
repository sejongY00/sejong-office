<script setup lang="ts">
import {
  computed,
  onActivated,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue';
import { useRouter } from 'vue-router';
import AppShell from '@/components/AppShell.vue';
import EditorToolbar from '@/components/EditorToolbar.vue';
import CornerEditor from '@/components/scanner/CornerEditor.vue';
import { consumeScannerFiles } from '@/composables/scannerSession';
import { usePageTitle } from '@/composables/usePageTitle';
import {
  detectCornersFromImage,
  ensureJscanify,
  fullFrameCorners,
  loadImageFromUrl,
} from '@/integrations/scanner/detect';
import { buildSearchablePdf } from '@/integrations/scanner/buildPdf';
import { recognizeImage, terminateOcrWorker } from '@/integrations/scanner/ocr';
import {
  isPdfFile,
  isScannerImageFile,
  renderPdfToImages,
} from '@/integrations/scanner/pdfPages';
import type {
  CornerPoints,
  PaperAspect,
  ScannerPage,
} from '@/integrations/scanner/types';
import { warpImage } from '@/integrations/scanner/warp';
import { downloadBlob } from '@/utils/downloadBlob';

defineOptions({ name: 'ToolsScannerView' });

const router = useRouter();
const fileInput = ref<HTMLInputElement | null>(null);
const cameraInput = ref<HTMLInputElement | null>(null);
const pages = ref<ScannerPage[]>([]);
const activeId = ref<string | null>(null);
const filename = ref('문서 스캔');
const busy = ref(false);
const progress = ref(0);
const progressLabel = ref('');
const error = ref('');
const notice = ref('');
const engineReady = ref(false);
const enableOcr = ref(true);
const fileDropActive = ref(false);
const dragPageId = ref<string | null>(null);
const dropTargetId = ref<string | null>(null);

usePageTitle(filename);

const activePage = computed(
  () => pages.value.find((page) => page.id === activeId.value) ?? null,
);

const warpedCount = computed(
  () => pages.value.filter((page) => page.warpedUrl).length,
);

function revokeUrl(url: string | null) {
  if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
}

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

async function pushPageFromSource(
  name: string,
  sourceUrl: string,
  width: number,
  height: number,
) {
  const image = await loadImageFromUrl(sourceUrl);
  const w = width || image.naturalWidth || image.width;
  const h = height || image.naturalHeight || image.height;
  let corners: CornerPoints;
  try {
    corners = detectCornersFromImage(image);
  } catch {
    corners = fullFrameCorners(w, h);
  }
  const page: ScannerPage = {
    id: createId(),
    name,
    sourceUrl,
    sourceWidth: w,
    sourceHeight: h,
    corners,
    aspect: 'a4-portrait',
    warpedUrl: null,
    warpedWidth: 0,
    warpedHeight: 0,
    ocr: null,
  };
  pages.value.push(page);
  if (!activeId.value) activeId.value = page.id;
  filename.value = name;
}

async function addFiles(files: File[]) {
  const images = files.filter(isScannerImageFile);
  const pdfs = files.filter(isPdfFile);
  if (!images.length && !pdfs.length) {
    error.value = 'PNG, JPEG, WebP 이미지 또는 PDF를 선택해 주세요.';
    return;
  }
  error.value = '';
  busy.value = true;
  progressLabel.value = '파일 준비 중';
  let added = 0;
  try {
    await ensureJscanify();
    engineReady.value = true;

    for (const file of images) {
      progressLabel.value = `${file.name} 분석 중`;
      const sourceUrl = URL.createObjectURL(file);
      await pushPageFromSource(file.name, sourceUrl, 0, 0);
      added += 1;
    }

    for (const file of pdfs) {
      progressLabel.value = `${file.name} PDF 변환 중`;
      const rendered = await renderPdfToImages(file, (done, total) => {
        progress.value = total ? done / total : 0;
        progressLabel.value = `${file.name} 페이지 ${done}/${total}`;
      });
      for (const page of rendered) {
        progressLabel.value = `${page.name} 분석 중`;
        const sourceUrl = URL.createObjectURL(page.blob);
        await pushPageFromSource(page.name, sourceUrl, page.width, page.height);
        added += 1;
      }
    }

    notice.value = `${added}장을 추가했습니다. 드래그로 순서를 바꿀 수 있습니다.`;
  } catch (reason) {
    error.value =
      reason instanceof Error
        ? reason.message
        : '스캐너를 초기화하지 못했습니다.';
  } finally {
    busy.value = false;
    progress.value = 0;
    progressLabel.value = '';
  }
}

function consumePending() {
  const pending = consumeScannerFiles();
  if (pending.length) void addFiles(pending);
}

onMounted(() => {
  void ensureJscanify()
    .then(() => {
      engineReady.value = true;
    })
    .catch((reason) => {
      error.value =
        reason instanceof Error
          ? reason.message
          : 'OpenCV/jscanify를 불러오지 못했습니다.';
    });
  consumePending();
});

onActivated(consumePending);

onBeforeUnmount(() => {
  for (const page of pages.value) {
    revokeUrl(page.sourceUrl);
    revokeUrl(page.warpedUrl);
  }
  void terminateOcrWorker();
});

watch(activePage, (page) => {
  if (page) filename.value = page.name;
});

function onOpen() {
  fileInput.value?.click();
}

function onCamera() {
  cameraInput.value?.click();
}

function onFilesSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  const selected = Array.from(input.files ?? []);
  input.value = '';
  if (selected.length) void addFiles(selected);
}

function selectPage(id: string) {
  activeId.value = id;
}

function removePage(id: string) {
  const index = pages.value.findIndex((page) => page.id === id);
  if (index < 0) return;
  const [removed] = pages.value.splice(index, 1);
  revokeUrl(removed.sourceUrl);
  revokeUrl(removed.warpedUrl);
  if (activeId.value === id) {
    activeId.value = pages.value[index]?.id ?? pages.value[index - 1]?.id ?? null;
  }
}

function movePage(fromId: string, toId: string) {
  if (fromId === toId) return;
  const from = pages.value.findIndex((page) => page.id === fromId);
  const to = pages.value.findIndex((page) => page.id === toId);
  if (from < 0 || to < 0) return;
  const [item] = pages.value.splice(from, 1);
  pages.value.splice(to, 0, item);
}

function onPageDragStart(event: DragEvent, id: string) {
  if (busy.value) {
    event.preventDefault();
    return;
  }
  dragPageId.value = id;
  event.dataTransfer?.setData('text/page-id', id);
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
  }
}

function onPageDragOver(event: DragEvent, id: string) {
  if (!dragPageId.value || dragPageId.value === id) return;
  event.preventDefault();
  dropTargetId.value = id;
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
}

function onPageDrop(event: DragEvent, id: string) {
  event.preventDefault();
  const fromId =
    dragPageId.value || event.dataTransfer?.getData('text/page-id') || '';
  if (fromId) movePage(fromId, id);
  dragPageId.value = null;
  dropTargetId.value = null;
}

function onPageDragEnd() {
  dragPageId.value = null;
  dropTargetId.value = null;
}

function onFileDragOver(event: DragEvent) {
  if (busy.value) return;
  if (![...((event.dataTransfer?.types as string[]) ?? [])].includes('Files')) {
    return;
  }
  event.preventDefault();
  fileDropActive.value = true;
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
}

function onFileDragLeave(event: DragEvent) {
  const related = event.relatedTarget as Node | null;
  if (related && (event.currentTarget as Node).contains(related)) return;
  fileDropActive.value = false;
}

function onFileDrop(event: DragEvent) {
  event.preventDefault();
  fileDropActive.value = false;
  if (busy.value) return;
  const files = Array.from(event.dataTransfer?.files ?? []);
  if (files.length) void addFiles(files);
}

function updateCorners(corners: CornerPoints) {
  if (!activePage.value) return;
  activePage.value.corners = corners;
  revokeUrl(activePage.value.warpedUrl);
  activePage.value.warpedUrl = null;
  activePage.value.ocr = null;
}

function updateAspect(aspect: PaperAspect) {
  if (!activePage.value) return;
  activePage.value.aspect = aspect;
  revokeUrl(activePage.value.warpedUrl);
  activePage.value.warpedUrl = null;
  activePage.value.ocr = null;
}

async function redetectActive() {
  if (!activePage.value) return;
  busy.value = true;
  try {
    await ensureJscanify();
    const image = await loadImageFromUrl(activePage.value.sourceUrl);
    activePage.value.corners = detectCornersFromImage(image);
    revokeUrl(activePage.value.warpedUrl);
    activePage.value.warpedUrl = null;
    activePage.value.ocr = null;
  } catch (reason) {
    error.value =
      reason instanceof Error ? reason.message : '코너 검출에 실패했습니다.';
  } finally {
    busy.value = false;
  }
}

function useFullFrame() {
  if (!activePage.value) return;
  activePage.value.corners = fullFrameCorners(
    activePage.value.sourceWidth,
    activePage.value.sourceHeight,
  );
  revokeUrl(activePage.value.warpedUrl);
  activePage.value.warpedUrl = null;
  activePage.value.ocr = null;
}

async function warpActive() {
  if (!activePage.value) return;
  busy.value = true;
  progressLabel.value = '원근 보정 중';
  try {
    const result = await warpImage(
      activePage.value.sourceUrl,
      activePage.value.corners,
      activePage.value.aspect,
    );
    revokeUrl(activePage.value.warpedUrl);
    activePage.value.warpedUrl = result.url;
    activePage.value.warpedWidth = result.width;
    activePage.value.warpedHeight = result.height;
    activePage.value.ocr = null;
    notice.value = '보정을 적용했습니다.';
  } catch (reason) {
    error.value =
      reason instanceof Error ? reason.message : '보정에 실패했습니다.';
  } finally {
    busy.value = false;
    progressLabel.value = '';
  }
}

async function warpAll() {
  busy.value = true;
  error.value = '';
  try {
    for (let i = 0; i < pages.value.length; i += 1) {
      const page = pages.value[i];
      progress.value = i / pages.value.length;
      progressLabel.value = `${page.name} 보정 중`;
      const result = await warpImage(page.sourceUrl, page.corners, page.aspect);
      revokeUrl(page.warpedUrl);
      page.warpedUrl = result.url;
      page.warpedWidth = result.width;
      page.warpedHeight = result.height;
      page.ocr = null;
    }
    notice.value = '모든 페이지를 보정했습니다.';
  } catch (reason) {
    error.value =
      reason instanceof Error ? reason.message : '일괄 보정에 실패했습니다.';
  } finally {
    busy.value = false;
    progress.value = 0;
    progressLabel.value = '';
  }
}

async function runOcrOnPage(page: ScannerPage) {
  if (!page.warpedUrl) {
    const result = await warpImage(page.sourceUrl, page.corners, page.aspect);
    revokeUrl(page.warpedUrl);
    page.warpedUrl = result.url;
    page.warpedWidth = result.width;
    page.warpedHeight = result.height;
  }
  page.ocr = await recognizeImage(page.warpedUrl!, (value, label) => {
    progress.value = value;
    progressLabel.value = `${page.name}: ${label}`;
  });
}

async function runOcrActive() {
  if (!activePage.value) return;
  busy.value = true;
  error.value = '';
  try {
    await runOcrOnPage(activePage.value);
    notice.value = 'OCR을 완료했습니다.';
  } catch (reason) {
    error.value =
      reason instanceof Error ? reason.message : 'OCR에 실패했습니다.';
  } finally {
    busy.value = false;
    progress.value = 0;
    progressLabel.value = '';
  }
}

async function runOcrAll() {
  busy.value = true;
  error.value = '';
  try {
    for (let i = 0; i < pages.value.length; i += 1) {
      progressLabel.value = `OCR ${i + 1}/${pages.value.length}`;
      await runOcrOnPage(pages.value[i]);
    }
    notice.value = '모든 페이지 OCR을 완료했습니다.';
  } catch (reason) {
    error.value =
      reason instanceof Error ? reason.message : 'OCR에 실패했습니다.';
  } finally {
    busy.value = false;
    progress.value = 0;
    progressLabel.value = '';
  }
}

async function blobFromUrl(url: string) {
  const response = await fetch(url);
  return response.arrayBuffer();
}

async function exportPdf() {
  if (!pages.value.length) return;
  busy.value = true;
  error.value = '';
  try {
    const inputs = [];
    for (let i = 0; i < pages.value.length; i += 1) {
      const page = pages.value[i];
      progress.value = i / pages.value.length;
      progressLabel.value = `${page.name} PDF 준비`;
      if (!page.warpedUrl) {
        const warped = await warpImage(
          page.sourceUrl,
          page.corners,
          page.aspect,
        );
        revokeUrl(page.warpedUrl);
        page.warpedUrl = warped.url;
        page.warpedWidth = warped.width;
        page.warpedHeight = warped.height;
      }
      if (enableOcr.value && !page.ocr) {
        await runOcrOnPage(page);
      }
      inputs.push({
        imageBytes: await blobFromUrl(page.warpedUrl!),
        width: page.warpedWidth,
        height: page.warpedHeight,
        ocr: enableOcr.value ? page.ocr : null,
      });
    }
    progressLabel.value = 'PDF 생성 중';
    const bytes = await buildSearchablePdf(inputs);
    downloadBlob(
      new Blob([Uint8Array.from(bytes)], { type: 'application/pdf' }),
      `${baseName()}.pdf`,
    );
    notice.value = enableOcr.value
      ? '검색 가능한 OCR PDF를 저장했습니다.'
      : '스캔 PDF를 저장했습니다.';
  } catch (reason) {
    error.value =
      reason instanceof Error ? reason.message : 'PDF 저장에 실패했습니다.';
  } finally {
    busy.value = false;
    progress.value = 0;
    progressLabel.value = '';
  }
}

async function exportActivePng() {
  if (!activePage.value) return;
  if (!activePage.value.warpedUrl) await warpActive();
  if (!activePage.value?.warpedUrl) return;
  const response = await fetch(activePage.value.warpedUrl);
  downloadBlob(await response.blob(), `${baseName(activePage.value.name)}.png`);
}

function baseName(name = filename.value) {
  return name.replace(/\.[^.]+$/, '') || 'scan';
}

function onClose() {
  void router.push({ name: 'home' });
}

const progressPercent = computed(() =>
  Math.round(Math.min(1, Math.max(0, progress.value)) * 100),
);
</script>

<template>
  <AppShell :editor="true">
    <div class="scan-page">
      <EditorToolbar
        :filename="filename"
        save-label="PDF 저장"
        :show-save="pages.length > 0"
        :busy="busy"
        @open="onOpen"
        @save="exportPdf"
        @close="onClose"
      />
      <input
        ref="fileInput"
        class="sr-only"
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/bmp,.png,.jpg,.jpeg,.webp,.pdf,application/pdf"
        multiple
        @change="onFilesSelected"
      />
      <input
        ref="cameraInput"
        class="sr-only"
        type="file"
        accept="image/*"
        capture="environment"
        @change="onFilesSelected"
      />

      <p v-if="error" class="viewer-message viewer-message--error" role="alert">
        {{ error }}
      </p>
      <p v-else-if="notice" class="viewer-message">{{ notice }}</p>

      <div class="layout">
        <aside class="queue">
          <div class="queue__actions">
            <button type="button" :disabled="busy" @click="onOpen">
              파일 추가
            </button>
            <button type="button" :disabled="busy" @click="onCamera">
              카메라
            </button>
          </div>
          <ul v-if="pages.length" class="queue__list">
            <li
              v-for="(page, index) in pages"
              :key="page.id"
              :class="{
                active: page.id === activeId,
                'is-drop-target': dropTargetId === page.id,
                'is-dragging': dragPageId === page.id,
              }"
              draggable="true"
              @dragstart="onPageDragStart($event, page.id)"
              @dragover="onPageDragOver($event, page.id)"
              @drop="onPageDrop($event, page.id)"
              @dragend="onPageDragEnd"
            >
              <button type="button" class="queue__item" @click="selectPage(page.id)">
                <strong>{{ index + 1 }}. {{ page.name }}</strong>
                <span>
                  {{ page.warpedUrl ? '보정됨' : '원본' }}
                  <template v-if="page.ocr"> · OCR</template>
                </span>
              </button>
              <button
                type="button"
                class="queue__remove"
                :disabled="busy"
                @click="removePage(page.id)"
              >
                삭제
              </button>
            </li>
          </ul>
          <p v-else class="muted">이미지·PDF를 추가하거나 아래에 놓으세요.</p>
          <div
            class="queue__drop"
            :class="{ 'is-active': fileDropActive }"
            @dragenter="onFileDragOver"
            @dragover="onFileDragOver"
            @dragleave="onFileDragLeave"
            @drop="onFileDrop"
          >
            여기에 놓아 추가
          </div>
        </aside>

        <main
          class="workspace"
          @dragenter="onFileDragOver"
          @dragover="onFileDragOver"
          @dragleave="onFileDragLeave"
          @drop="onFileDrop"
        >
          <div v-if="!activePage" class="empty" :class="{ 'is-drop-active': fileDropActive }">
            <strong>문서 스캐너</strong>
            <span>
              이미지 또는 PDF를 올리면 페이지를 목록에 추가합니다. 드래그로 순서를
              바꾼 뒤 보정·OCR·검색 가능 PDF로 저장할 수 있습니다. 처리는 모두
              브라우저에서 수행됩니다.
            </span>
            <div class="empty__actions">
              <button type="button" :disabled="!engineReady || busy" @click="onOpen">
                파일 열기
              </button>
              <button type="button" :disabled="!engineReady || busy" @click="onCamera">
                카메라 촬영
              </button>
            </div>
          </div>

          <template v-else>
            <div class="toolbar-row">
              <label>
                용지
                <select
                  :value="activePage.aspect"
                  :disabled="busy"
                  @change="
                    updateAspect(
                      ($event.target as HTMLSelectElement).value as any,
                    )
                  "
                >
                  <option value="a4-portrait">A4 세로</option>
                  <option value="a4-landscape">A4 가로</option>
                  <option value="square">정사각</option>
                  <option value="auto">자동 비율</option>
                </select>
              </label>
              <button type="button" :disabled="busy" @click="redetectActive">
                다시 검출
              </button>
              <button type="button" :disabled="busy" @click="useFullFrame">
                전체 이미지
              </button>
              <button type="button" :disabled="busy" @click="warpActive">
                이 장 보정
              </button>
              <button type="button" :disabled="busy" @click="warpAll">
                모두 보정
              </button>
              <label class="check">
                <input v-model="enableOcr" type="checkbox" :disabled="busy" />
                PDF에 OCR 텍스트 포함
              </label>
              <button type="button" :disabled="busy" @click="runOcrActive">
                이 장 OCR
              </button>
              <button type="button" :disabled="busy" @click="runOcrAll">
                모두 OCR
              </button>
              <button type="button" :disabled="busy" @click="exportActivePng">
                PNG로 저장
              </button>
            </div>

            <div class="panes">
              <section class="pane">
                <h2>코너 편집</h2>
                <CornerEditor
                  :image-url="activePage.sourceUrl"
                  :corners="activePage.corners"
                  :disabled="busy"
                  @update:corners="updateCorners"
                />
              </section>
              <section class="pane">
                <h2>보정 미리보기</h2>
                <img
                  v-if="activePage.warpedUrl"
                  class="preview"
                  :src="activePage.warpedUrl"
                  alt="보정된 스캔"
                />
                <p v-else class="muted">보정 후 미리보기가 표시됩니다.</p>
                <div v-if="activePage.ocr" class="ocr-box">
                  <h3>OCR 결과</h3>
                  <pre>{{ activePage.ocr.text || '(텍스트 없음)' }}</pre>
                </div>
              </section>
            </div>
          </template>

          <div v-if="busy && progressLabel" class="progress" aria-live="polite">
            <span>{{ progressLabel }}</span>
            <progress :value="progressPercent" max="100" />
            <small>{{ progressPercent }}% · {{ warpedCount }}/{{ pages.length }}</small>
          </div>
        </main>
      </div>
    </div>
  </AppShell>
</template>

<style scoped>
.scan-page {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  background: var(--canvas);
}

.layout {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  flex: 1;
  min-height: 0;
}

.queue {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  min-height: 0;
  padding: 0.85rem;
  overflow: auto;
  border-right: 1px solid var(--border);
  background: var(--surface);
  color: var(--ink);
}

.queue__actions,
.empty__actions,
.toolbar-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.queue__actions button,
.empty__actions button,
.toolbar-row button,
.toolbar-row select {
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 0.35rem 0.55rem;
  background: var(--canvas);
  color: var(--ink);
  font: inherit;
  cursor: pointer;
}

.queue__list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 0.4rem;
}

.queue__list li {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.25rem;
}

.queue__list li.is-drop-target .queue__item {
  border-color: var(--accent);
  box-shadow: inset 0 0 0 1px var(--accent);
}

.queue__list li.is-dragging {
  opacity: 0.55;
}

.queue__item {
  display: grid;
  gap: 0.15rem;
  padding: 0.45rem 0.5rem;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: transparent;
  color: inherit;
  text-align: left;
  font: inherit;
  cursor: grab;
}

.queue__list li.active .queue__item {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.queue__item strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.78rem;
}

.queue__item span,
.muted {
  color: var(--muted);
  font-size: 0.72rem;
}

.queue__remove {
  border: 0;
  background: transparent;
  color: var(--muted);
  font: inherit;
  cursor: pointer;
}

.queue__drop {
  margin-top: auto;
  padding: 0.75rem 0.5rem;
  border: 1px dashed var(--border);
  border-radius: 4px;
  color: var(--muted);
  font-size: 0.75rem;
  text-align: center;
  transition:
    border-color 0.15s ease,
    background 0.15s ease,
    color 0.15s ease;
}

.queue__drop.is-active {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--ink);
}

.workspace {
  position: relative;
  min-width: 0;
  min-height: 0;
  overflow: auto;
  padding: 0.85rem;
}

.empty {
  height: 100%;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 0.7rem;
  text-align: center;
  color: var(--ink);
  border: 1px dashed transparent;
  border-radius: 6px;
  padding: 1rem;
}

.empty.is-drop-active {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.empty span {
  max-width: 36rem;
  color: var(--muted);
  font-size: 0.9rem;
}

.toolbar-row {
  margin-bottom: 0.75rem;
  align-items: center;
}

.toolbar-row label {
  display: inline-flex;
  gap: 0.35rem;
  align-items: center;
  font-size: 0.8rem;
}

.check {
  margin-left: 0.25rem;
}

.panes {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.85rem;
}

.pane {
  min-width: 0;
  padding: 0.75rem;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
}

.pane h2,
.pane h3 {
  margin: 0 0 0.65rem;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.preview {
  display: block;
  max-width: 100%;
  max-height: min(62vh, 720px);
  object-fit: contain;
  background: #111;
}

.ocr-box {
  margin-top: 0.75rem;
}

.ocr-box pre {
  margin: 0;
  max-height: 14rem;
  overflow: auto;
  padding: 0.65rem;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--canvas);
  color: var(--ink);
  white-space: pre-wrap;
  font-size: 0.78rem;
}

.progress {
  position: sticky;
  bottom: 0.5rem;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.35rem 0.65rem;
  margin-top: 0.75rem;
  padding: 0.65rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: 5px;
  background: color-mix(in srgb, var(--surface) 92%, transparent);
  backdrop-filter: blur(8px);
  font-size: 0.76rem;
}

.progress progress {
  grid-column: 1 / -1;
  width: 100%;
  accent-color: var(--accent);
}

.viewer-message {
  margin: 0;
  padding: 0.45rem 0.75rem;
  border-bottom: 1px solid var(--border);
  background: var(--accent-soft);
  color: var(--ink);
  font-size: 0.8rem;
}

.viewer-message--error {
  color: var(--danger);
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

  .queue {
    border-right: 0;
    border-bottom: 1px solid var(--border);
    max-height: 180px;
  }

  .panes {
    grid-template-columns: 1fr;
  }
}
</style>
