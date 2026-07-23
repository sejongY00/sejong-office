<script setup lang="ts">
import {
  nextTick,
  onActivated,
  onMounted,
  ref,
} from 'vue';
import { useRouter } from 'vue-router';
import { MlCadViewer } from '@mlightcad/cad-viewer';
import {
  AcApDocManager,
  AcApSettingManager,
  AcEdOpenMode,
} from '@mlightcad/cad-simple-viewer';
import AppShell from '@/components/AppShell.vue';
import EditorToolbar from '@/components/EditorToolbar.vue';
import { useFileDropZone } from '@/composables/useFileDropZone';
import { consumeViewerFiles } from '@/composables/viewerSession';
import { usePageTitle } from '@/composables/usePageTitle';
import { useSystemTheme } from '@/composables/useSystemTheme';

defineOptions({ name: 'CadViewerView' });

const WORKERS = {
  dxfParser: '/assets/dxf-parser-worker.js',
  dwgParser: '/assets/libredwg-parser-worker.js',
  mtextRender: '/assets/mtext-renderer-worker.js',
};

const router = useRouter();
const fileInput = ref<HTMLInputElement | null>(null);
const localFile = ref<File>();
const pendingFile = ref<File>();
const filename = ref('CAD 도면');
const ready = ref(false);
const viewerCreated = ref(false);
const fontReady = ref(false);
const error = ref('');
const notice = ref('');
const theme = useSystemTheme();

usePageTitle(filename);

const settings = AcApSettingManager.instance;
settings.set('isShowCommandLine', false);
settings.set('isShowCoordinate', true);
settings.set('isShowEntityInfo', true);
settings.set('isShowFileName', false);
settings.set('isShowLanguageSelector', false);
settings.set('isShowMainMenu', false);
settings.set('isShowStats', false);
settings.set('isShowToolbar', true);

function applyFiles(files: File[]) {
  const file = files.find((item) => /\.(?:dxf|dwg)$/i.test(item.name));
  if (!file) {
    if (files.length) {
      error.value = '.dxf 또는 .dwg 파일을 선택해 주세요.';
    }
    return;
  }
  pendingFile.value = file;
  if (fontReady.value) localFile.value = file;
  filename.value = file.name;
  error.value = '';
  notice.value =
    file.size > 200 * 1024 * 1024
      ? '대형 CAD 파일은 브라우저 메모리를 많이 사용할 수 있습니다.'
      : '';
}

const {
  dropActive,
  onDragEnter,
  onDragOver,
  onDragLeave,
  onDrop,
} = useFileDropZone(applyFiles);

async function initialize() {
  applyFiles(consumeViewerFiles('cad'));
  try {
    ready.value = await AcApDocManager.checkWebworkerReadiness(WORKERS);
    if (!ready.value) {
      error.value =
        'CAD 파싱 Worker를 불러오지 못했습니다. 정적 자산 경로를 확인해 주세요.';
    }
  } catch (reason) {
    error.value =
      reason instanceof Error
        ? reason.message
        : 'CAD 뷰어를 초기화하지 못했습니다.';
  }
}

onMounted(() => {
  void initialize();
});

onActivated(() => {
  const files = consumeViewerFiles('cad');
  if (!files.length) return;
  applyFiles(files);
});

function onOpen() {
  fileInput.value?.click();
}

function onFileSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files ?? []);
  input.value = '';
  if (!files.length) return;
  applyFiles(files);
  void nextTick();
}

async function onViewerCreated() {
  viewerCreated.value = true;
  try {
    await AcApDocManager.instance.loadFonts(['Noto Sans KR']);
  } catch {
    notice.value =
      '대체 글꼴을 불러오지 못했습니다. 일부 CAD 문자가 표시되지 않을 수 있습니다.';
  } finally {
    fontReady.value = true;
    if (pendingFile.value) localFile.value = pendingFile.value;
  }
}

function onClose() {
  void router.push({ name: 'home' });
}
</script>

<template>
  <AppShell :editor="true">
    <div
      class="cad-page"
      :class="{ 'is-drop-active': dropActive }"
      @dragenter="onDragEnter"
      @dragover="onDragOver"
      @dragleave="onDragLeave"
      @drop="onDrop"
    >
      <EditorToolbar
        :filename="filename"
        :show-save="false"
        :busy="!ready"
        @open="onOpen"
        @close="onClose"
      />
      <input
        ref="fileInput"
        class="sr-only"
        type="file"
        accept=".dxf,.dwg"
        @change="onFileSelected"
      />
      <p v-if="error" class="viewer-message viewer-message--error" role="alert">
        {{ error }}
      </p>
      <p v-else-if="notice" class="viewer-message">{{ notice }}</p>
      <div class="cad-host">
        <MlCadViewer
          v-if="ready"
          :local-file="localFile"
          :base-url="'/viewer-assets/cad-resources/'"
          :theme="theme"
          :mode="AcEdOpenMode.Read"
          :use-main-thread-draw="false"
          :progressive-rendering="true"
          :fail-on-font-load-error="false"
          locale="en"
          @create="onViewerCreated"
        />
        <div v-if="ready && !localFile && viewerCreated" class="empty-state">
          <strong>CAD 도면을 선택해 주세요.</strong>
          <span>
            DXF와 DWG 파일을 열거나 이 영역으로 끌어다 놓으세요. 처리는
            브라우저 안에서만 이뤄집니다.
          </span>
          <button type="button" @click="onOpen">파일 열기</button>
        </div>
        <div v-if="dropActive" class="drop-overlay" aria-hidden="true">
          DXF · DWG 파일을 놓으세요
        </div>
      </div>
    </div>
  </AppShell>
</template>

<style scoped>
.cad-page {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  background: var(--canvas);
}

.cad-host {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
}

.cad-host :deep(.ml-cad-viewer-container) {
  position: absolute !important;
  inset: 0 !important;
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

.empty-state {
  position: absolute;
  inset: 0;
  z-index: 10;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 0.65rem;
  background: var(--canvas);
  color: var(--ink);
  text-align: center;
}

.empty-state span {
  color: var(--muted);
  font-size: 0.85rem;
}

.empty-state button {
  border: 1px solid var(--accent);
  border-radius: 4px;
  padding: 0.45rem 0.85rem;
  background: var(--accent);
  color: white;
  font: inherit;
  cursor: pointer;
}

.drop-overlay {
  position: absolute;
  inset: 0.75rem;
  z-index: 30;
  display: grid;
  place-items: center;
  border: 2px dashed var(--accent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--accent-soft) 88%, transparent);
  color: var(--ink);
  font-weight: 650;
  pointer-events: none;
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
