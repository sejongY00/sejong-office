<script setup lang="ts">
import {
  computed,
  onActivated,
  onMounted,
  reactive,
  ref,
} from 'vue';
import { useRouter } from 'vue-router';
import AppShell from '@/components/AppShell.vue';
import EditorToolbar from '@/components/EditorToolbar.vue';
import Model3DCanvas from '@/components/model3d/Model3DCanvas.vue';
import ModelTreeItem from '@/components/model3d/ModelTreeItem.vue';
import { MODEL3D_EXTENSIONS } from '@/config/app';
import { consumeViewerFiles } from '@/composables/viewerSession';
import { useFileDropZone } from '@/composables/useFileDropZone';
import { usePageTitle } from '@/composables/usePageTitle';
import { useSystemTheme } from '@/composables/useSystemTheme';
import {
  downloadExportedFiles,
  exportModel,
  exportOptionById,
  findPrimaryModelFile,
} from '@/integrations/model3d/o3dv';
import type {
  ExportFormatId,
  ModelPropertyGroup,
  ModelStats,
  ModelTreeNode,
} from '@/integrations/model3d/types';
import { EXPORT_OPTIONS } from '@/integrations/model3d/types';
import { downloadBlob } from '@/utils/downloadBlob';

defineOptions({ name: 'Model3DViewerView' });

const ACCEPT = [
  ...MODEL3D_EXTENSIONS.map((ext) => `.${ext}`),
  '.bin',
  '.mtl',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.gif',
  '.bmp',
  '.tif',
  '.tiff',
].join(',');

const router = useRouter();
const fileInput = ref<HTMLInputElement | null>(null);
const canvas = ref<InstanceType<typeof Model3DCanvas> | null>(null);
const files = ref<File[]>([]);
const filename = ref('3D 모델');
const loading = ref(false);
const progress = ref(0);
const progressLabel = ref('');
const error = ref('');
const notice = ref('');
const stats = ref<ModelStats | null>(null);
const tree = ref<ModelTreeNode | null>(null);
const modelGroups = ref<ModelPropertyGroup[]>([]);
const selectionGroups = ref<ModelPropertyGroup[]>([]);
const selectedKey = ref<string | null>(null);
const hiddenKeys = reactive(new Set<string>());
const hiddenVersion = ref(0);
const edges = ref(false);
const projection = ref<'perspective' | 'orthographic'>('perspective');
const upAxis = ref<'y' | 'z'>('y');
const measureMode = ref(false);
const measureDistance = ref<number | null>(null);
const exportOpen = ref(false);
const exportBusy = ref(false);
const mainFilePrompt = ref<{
  names: string[];
  select: (index: number) => void;
} | null>(null);
const theme = useSystemTheme();

const progressPercent = computed(() =>
  Math.round(Math.min(1, Math.max(0, progress.value)) * 100),
);

const propertyGroups = computed(() =>
  selectedKey.value ? selectionGroups.value : modelGroups.value,
);

usePageTitle(filename, { faviconKind: 'model3d' });

function applyFiles(nextFiles: File[]) {
  const primary = findPrimaryModelFile(nextFiles);
  if (!primary) {
    error.value =
      '지원하는 3D 모델 파일(또는 ZIP)을 선택해 주세요.';
    return;
  }
  files.value = [...nextFiles];
  filename.value = primary.name;
  loading.value = true;
  progress.value = 0;
  progressLabel.value = '모델 준비 중';
  error.value = '';
  stats.value = null;
  tree.value = null;
  modelGroups.value = [];
  selectionGroups.value = [];
  selectedKey.value = null;
  hiddenKeys.clear();
  hiddenVersion.value = 0;
  measureMode.value = false;
  measureDistance.value = null;
  exportOpen.value = false;
  const totalBytes = nextFiles.reduce((sum, file) => sum + file.size, 0);
  notice.value =
    totalBytes > 400 * 1024 * 1024
      ? '선택한 파일이 400MB를 초과합니다. 브라우저 메모리 부족이 발생할 수 있습니다.'
      : '';
}

function consumePending() {
  const pending = consumeViewerFiles('model3d');
  if (pending.length) applyFiles(pending);
}

onMounted(consumePending);
onActivated(consumePending);

function onOpen() {
  fileInput.value?.click();
}

function onFilesSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  const selected = Array.from(input.files ?? []);
  input.value = '';
  if (selected.length) applyFiles(selected);
}

const {
  dropActive,
  onDragEnter,
  onDragOver,
  onDragLeave,
  onDrop,
} = useFileDropZone(applyFiles);

function onProgress(value: number, label: string) {
  progress.value = value;
  progressLabel.value = label;
  if (value < 1) loading.value = true;
}

function onLoaded(
  nextStats: ModelStats,
  nextTree: ModelTreeNode,
  groups: ModelPropertyGroup[],
  missingFiles: string[],
) {
  stats.value = nextStats;
  tree.value = nextTree;
  modelGroups.value = groups;
  loading.value = false;
  progress.value = 1;
  if (missingFiles.length) {
    notice.value = `누락된 보조 파일: ${missingFiles.join(', ')}`;
  }
}

function onError(message: string) {
  error.value = message;
  loading.value = false;
}

function onSelectMainFile(names: string[], select: (index: number) => void) {
  mainFilePrompt.value = { names, select };
}

function chooseMainFile(index: number) {
  mainFilePrompt.value?.select(index);
  mainFilePrompt.value = null;
}

function onSelect(key: string | null, groups: ModelPropertyGroup[]) {
  selectedKey.value = key;
  selectionGroups.value = groups;
}

function onTreeSelect(key: string | null) {
  canvas.value?.selectByKey(key);
}

function onToggleVisible(key: string) {
  if (hiddenKeys.has(key)) hiddenKeys.delete(key);
  else hiddenKeys.add(key);
  hiddenVersion.value += 1;
}

function onMeasure(distance: number | null) {
  measureDistance.value = distance;
}

function toggleMeasure() {
  measureMode.value = !measureMode.value;
  if (!measureMode.value) {
    canvas.value?.clearMeasure();
    measureDistance.value = null;
  }
}

async function onScreenshot() {
  const dataUrl = canvas.value?.screenshot();
  if (!dataUrl) return;
  const response = await fetch(dataUrl);
  downloadBlob(await response.blob(), `${baseName()}.png`);
}

function baseName() {
  return filename.value.replace(/\.[^.]+$/, '') || 'model';
}

async function onExport(id: ExportFormatId) {
  const model = canvas.value?.getModel();
  if (!model) return;
  exportBusy.value = true;
  error.value = '';
  try {
    const option = exportOptionById(id);
    const exported = await exportModel(
      model,
      option,
      hiddenKeys.size ? hiddenKeys : null,
    );
    await downloadExportedFiles(exported, baseName(), option);
    exportOpen.value = false;
  } catch (reason) {
    error.value =
      reason instanceof Error ? reason.message : '내보내기에 실패했습니다.';
  } finally {
    exportBusy.value = false;
  }
}

function onClose() {
  void router.push({ name: 'home' });
}
</script>

<template>
  <AppShell :editor="true">
    <div
      class="model-page"
      :class="{ 'is-drop-active': dropActive }"
      @dragenter="onDragEnter"
      @dragover="onDragOver"
      @dragleave="onDragLeave"
      @drop="onDrop"
    >
      <EditorToolbar
        :filename="filename"
        :show-save="Boolean(stats)"
        :busy="loading || exportBusy"
        @open="onOpen"
        @save="exportOpen = !exportOpen"
        @close="onClose"
      />
      <input
        ref="fileInput"
        class="sr-only"
        type="file"
        :accept="ACCEPT"
        multiple
        @change="onFilesSelected"
      />

      <p v-if="error" class="viewer-message viewer-message--error" role="alert">
        {{ error }}
      </p>
      <p v-else-if="notice" class="viewer-message">{{ notice }}</p>

      <div v-if="exportOpen" class="export-bar">
        <span>내보내기 형식</span>
        <button
          v-for="option in EXPORT_OPTIONS"
          :key="option.id"
          type="button"
          :disabled="exportBusy"
          @click="onExport(option.id)"
        >
          {{ option.label }}
        </button>
      </div>

      <div v-if="mainFilePrompt" class="main-file-dialog" role="dialog">
        <div class="main-file-dialog__panel">
          <h2>주 파일 선택</h2>
          <p>여러 모델 파일이 있습니다. 열 파일을 고르세요.</p>
          <button
            v-for="(name, index) in mainFilePrompt.names"
            :key="name"
            type="button"
            @click="chooseMainFile(index)"
          >
            {{ name }}
          </button>
        </div>
      </div>

      <div class="viewer-layout">
        <main class="viewport">
          <Model3DCanvas
            v-if="files.length"
            ref="canvas"
            :files="files"
            :theme="theme"
            :edges="edges"
            :projection="projection"
            :up-axis="upAxis"
            :measure-mode="measureMode"
            :hidden-keys="hiddenKeys"
            :hidden-version="hiddenVersion"
            :selected-key="selectedKey"
            @progress="onProgress"
            @loaded="onLoaded"
            @error="onError"
            @select-main-file="onSelectMainFile"
            @select="onSelect"
            @measure="onMeasure"
          />
          <div v-else class="empty-state">
            <strong>3D 모델을 선택해 주세요.</strong>
            <span>
              Online3DViewer가 지원하는 형식과 ZIP, 보조 텍스처를 함께 열거나
              이 영역으로 끌어다 놓을 수 있습니다. 면 없는 PLY는 포인트
              클라우드로 표시됩니다.
            </span>
            <button type="button" @click="onOpen">파일 열기</button>
          </div>

          <div v-if="files.length" class="viewport-tools">
            <button type="button" @click="canvas?.fitCamera()">뷰 초기화</button>
            <button
              type="button"
              :aria-pressed="projection === 'orthographic'"
              @click="
                projection =
                  projection === 'perspective' ? 'orthographic' : 'perspective'
              "
            >
              {{ projection === 'perspective' ? '원근' : '직교' }}
            </button>
            <button
              type="button"
              @click="upAxis = upAxis === 'y' ? 'z' : 'y'"
            >
              Up {{ upAxis.toUpperCase() }}
            </button>
            <button
              type="button"
              :aria-pressed="edges"
              @click="edges = !edges"
            >
              에지 {{ edges ? 'ON' : 'OFF' }}
            </button>
            <button
              type="button"
              :aria-pressed="measureMode"
              @click="toggleMeasure"
            >
              측정 {{ measureMode ? 'ON' : 'OFF' }}
            </button>
            <button type="button" :disabled="!stats" @click="onScreenshot">
              스크린샷
            </button>
          </div>

          <p v-if="measureMode" class="measure-hint">
            메시 위 두 점을 클릭하세요
            <template v-if="measureDistance !== null">
              · 거리 {{ measureDistance.toFixed(4) }}
            </template>
          </p>

          <div v-if="loading" class="progress" aria-live="polite">
            <span>{{ progressLabel }}</span>
            <progress :value="progressPercent" max="100" />
            <small>{{ progressPercent }}%</small>
          </div>

          <div v-if="dropActive" class="drop-overlay" aria-hidden="true">
            3D 모델 파일을 놓으세요
          </div>
        </main>

        <aside class="inspector">
          <section>
            <h2>모델 통계</h2>
            <dl v-if="stats">
              <div>
                <dt>노드</dt>
                <dd>{{ stats.nodes.toLocaleString() }}</dd>
              </div>
              <div>
                <dt>메시</dt>
                <dd>{{ stats.meshes.toLocaleString() }}</dd>
              </div>
              <div>
                <dt>인스턴스</dt>
                <dd>{{ stats.meshInstances.toLocaleString() }}</dd>
              </div>
              <div>
                <dt>정점</dt>
                <dd>{{ stats.vertices.toLocaleString() }}</dd>
              </div>
              <div>
                <dt>삼각형</dt>
                <dd>{{ Math.round(stats.triangles).toLocaleString() }}</dd>
              </div>
              <div>
                <dt>재질</dt>
                <dd>{{ stats.materials.toLocaleString() }}</dd>
              </div>
            </dl>
            <p v-else>모델을 열면 통계를 표시합니다.</p>
          </section>

          <section class="structure">
            <h2>구조</h2>
            <ul v-if="tree">
              <ModelTreeItem
                :node="tree"
                :selected-key="selectedKey"
                :hidden-keys="hiddenKeys"
                @select="onTreeSelect"
                @toggle-visible="onToggleVisible"
              />
            </ul>
            <p v-else>모델 구조가 없습니다.</p>
          </section>

          <section>
            <h2>{{ selectedKey ? '선택 속성' : '모델 속성' }}</h2>
            <template v-if="propertyGroups.length">
              <div
                v-for="group in propertyGroups"
                :key="group.name"
                class="prop-group"
              >
                <h3>{{ group.name }}</h3>
                <dl>
                  <div v-for="row in group.properties" :key="row.name">
                    <dt>{{ row.name }}</dt>
                    <dd>{{ row.value }}</dd>
                  </div>
                </dl>
              </div>
            </template>
            <p v-else>속성 정보가 없습니다.</p>
          </section>
        </aside>
      </div>
    </div>
  </AppShell>
</template>

<style scoped>
.model-page {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  background: var(--canvas);
}

.viewer-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 260px;
  flex: 1 1 auto;
  min-height: 0;
}

.viewport {
  position: relative;
  min-width: 0;
  min-height: 0;
}

.inspector {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-height: 0;
  padding: 0.85rem;
  overflow: auto;
  border-left: 1px solid var(--border);
  background: var(--surface);
  color: var(--ink);
}

.inspector h2,
.inspector h3 {
  margin: 0 0 0.55rem;
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.inspector h3 {
  margin-top: 0.55rem;
  color: var(--muted);
}

.inspector p {
  margin: 0;
  color: var(--muted);
  font-size: 0.75rem;
}

.inspector dl {
  display: grid;
  gap: 0.3rem;
  margin: 0;
}

.inspector dl div {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  font-size: 0.76rem;
}

.inspector dt {
  color: var(--muted);
}

.inspector dd {
  margin: 0;
  font-variant-numeric: tabular-nums;
  text-align: right;
  overflow-wrap: anywhere;
}

.structure {
  min-height: 0;
}

.structure > ul {
  margin: 0;
  padding: 0;
}

.prop-group + .prop-group {
  margin-top: 0.75rem;
}

.empty-state {
  height: 100%;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 0.65rem;
  padding: 1rem;
  color: var(--ink);
  text-align: center;
}

.empty-state span {
  max-width: 34rem;
  color: var(--muted);
  font-size: 0.85rem;
}

.empty-state button,
.viewport-tools button,
.export-bar button,
.main-file-dialog button {
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 0.42rem 0.75rem;
  background: color-mix(in srgb, var(--surface) 88%, transparent);
  color: var(--ink);
  font: inherit;
  cursor: pointer;
  backdrop-filter: blur(8px);
}

.empty-state button {
  border-color: var(--accent);
  background: var(--accent);
  color: white;
}

.viewport-tools {
  position: absolute;
  top: 0.75rem;
  left: 0.75rem;
  z-index: 2;
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  max-width: calc(100% - 1.5rem);
}

.viewport-tools button[aria-pressed='true'] {
  border-color: var(--accent);
  color: var(--accent);
}

.measure-hint {
  position: absolute;
  left: 50%;
  top: 0.75rem;
  z-index: 2;
  margin: 0;
  padding: 0.35rem 0.65rem;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: color-mix(in srgb, var(--surface) 90%, transparent);
  color: var(--ink);
  font-size: 0.75rem;
  transform: translateX(-50%);
  backdrop-filter: blur(8px);
}

.progress {
  position: absolute;
  left: 50%;
  bottom: 1rem;
  z-index: 2;
  display: grid;
  grid-template-columns: minmax(8rem, 18rem) 3rem;
  gap: 0.35rem 0.65rem;
  width: min(26rem, calc(100% - 2rem));
  padding: 0.65rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: 5px;
  background: color-mix(in srgb, var(--surface) 92%, transparent);
  color: var(--ink);
  transform: translateX(-50%);
  backdrop-filter: blur(10px);
  font-size: 0.76rem;
}

.progress progress {
  grid-column: 1 / -1;
  width: 100%;
  accent-color: var(--accent);
}

.progress small {
  text-align: right;
}

.drop-overlay {
  position: absolute;
  inset: 0.75rem;
  z-index: 25;
  display: grid;
  place-items: center;
  border: 2px dashed var(--accent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--accent-soft) 88%, transparent);
  color: var(--ink);
  font-weight: 650;
  pointer-events: none;
}

.export-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  align-items: center;
  padding: 0.45rem 0.75rem;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
  color: var(--ink);
  font-size: 0.78rem;
}

.main-file-dialog {
  position: absolute;
  inset: 0;
  z-index: 5;
  display: grid;
  place-items: center;
  background: color-mix(in srgb, black 35%, transparent);
}

.main-file-dialog__panel {
  display: grid;
  gap: 0.55rem;
  width: min(24rem, calc(100% - 2rem));
  padding: 1rem;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
  color: var(--ink);
}

.main-file-dialog h2 {
  margin: 0;
  font-size: 1rem;
}

.main-file-dialog p {
  margin: 0;
  color: var(--muted);
  font-size: 0.85rem;
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

@media (max-width: 760px) {
  .viewer-layout {
    grid-template-columns: 1fr;
  }

  .inspector {
    display: none;
  }
}
</style>
