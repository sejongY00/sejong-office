<script setup lang="ts">
import {
  computed,
  onActivated,
  onMounted,
  ref,
} from 'vue';
import { useRouter } from 'vue-router';
import AppShell from '@/components/AppShell.vue';
import EditorToolbar from '@/components/EditorToolbar.vue';
import Model3DCanvas from '@/components/model3d/Model3DCanvas.vue';
import ModelTreeItem from '@/components/model3d/ModelTreeItem.vue';
import { extensionOf } from '@/config/app';
import { consumeViewerFiles } from '@/composables/viewerSession';
import { usePageTitle } from '@/composables/usePageTitle';
import { useSystemTheme } from '@/composables/useSystemTheme';
import type {
  ModelStats,
  ModelTreeNode,
} from '@/integrations/model3d/types';

defineOptions({ name: 'Model3DViewerView' });

const PRIMARY_EXTENSIONS = new Set([
  'glb',
  'gltf',
  'obj',
  'step',
  'stp',
  'ifc',
]);

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
const theme = useSystemTheme();

const progressPercent = computed(() =>
  Math.round(Math.min(1, Math.max(0, progress.value)) * 100),
);

usePageTitle(filename);

function applyFiles(nextFiles: File[]) {
  const primary = nextFiles.find((file) =>
    PRIMARY_EXTENSIONS.has(extensionOf(file.name)),
  );
  if (!primary) {
    error.value =
      'GLB, glTF, OBJ, STEP 또는 IFC 모델 파일을 선택해 주세요.';
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

function onProgress(value: number, label: string) {
  loading.value = true;
  progress.value = value;
  progressLabel.value = label;
}

function onLoaded(nextStats: ModelStats, nextTree: ModelTreeNode) {
  stats.value = nextStats;
  tree.value = nextTree;
  loading.value = false;
  progress.value = 1;
}

function onError(message: string) {
  error.value = message;
  loading.value = false;
}

function onClose() {
  void router.push({ name: 'home' });
}
</script>

<template>
  <AppShell :editor="true">
    <div class="model-page">
      <EditorToolbar
        :filename="filename"
        :show-save="false"
        :busy="loading"
        @open="onOpen"
        @close="onClose"
      />
      <input
        ref="fileInput"
        class="sr-only"
        type="file"
        accept=".glb,.gltf,.obj,.mtl,.step,.stp,.ifc,.bin,.png,.jpg,.jpeg,.webp"
        multiple
        @change="onFilesSelected"
      />

      <p v-if="error" class="viewer-message viewer-message--error" role="alert">
        {{ error }}
      </p>
      <p v-else-if="notice" class="viewer-message">{{ notice }}</p>

      <div class="viewer-layout">
        <main class="viewport">
          <Model3DCanvas
            v-if="files.length"
            ref="canvas"
            :files="files"
            :theme="theme"
            @progress="onProgress"
            @loaded="onLoaded"
            @error="onError"
          />
          <div v-else class="empty-state">
            <strong>3D 모델을 선택해 주세요.</strong>
            <span>
              glTF의 BIN·텍스처나 OBJ의 MTL·텍스처도 함께 선택할 수 있습니다.
            </span>
            <button type="button" @click="onOpen">파일 열기</button>
          </div>
          <button
            v-if="files.length"
            type="button"
            class="reset-view"
            @click="canvas?.fitCamera()"
          >
            뷰 초기화
          </button>
          <div v-if="loading" class="progress" aria-live="polite">
            <span>{{ progressLabel }}</span>
            <progress :value="progressPercent" max="100" />
            <small>{{ progressPercent }}%</small>
          </div>
        </main>

        <aside class="inspector">
          <section>
            <h2>모델 통계</h2>
            <dl v-if="stats">
              <div><dt>객체</dt><dd>{{ stats.objects.toLocaleString() }}</dd></div>
              <div><dt>메시</dt><dd>{{ stats.meshes.toLocaleString() }}</dd></div>
              <div><dt>정점</dt><dd>{{ stats.vertices.toLocaleString() }}</dd></div>
              <div><dt>삼각형</dt><dd>{{ Math.round(stats.triangles).toLocaleString() }}</dd></div>
              <div><dt>애니메이션</dt><dd>{{ stats.animations }}</dd></div>
            </dl>
            <p v-else>모델을 열면 통계를 표시합니다.</p>
          </section>
          <section class="structure">
            <h2>구조</h2>
            <ul v-if="tree">
              <ModelTreeItem :node="tree" />
            </ul>
            <p v-else>모델 구조가 없습니다.</p>
          </section>
        </aside>
      </div>
    </div>
  </AppShell>
</template>

<style scoped>
.model-page {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  background: var(--canvas);
}

.viewer-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 230px;
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

.inspector h2 {
  margin: 0 0 0.55rem;
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
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
}

.structure {
  min-height: 0;
}

.structure > ul {
  margin: 0;
  padding: 0;
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
.reset-view {
  border: 1px solid var(--accent);
  border-radius: 4px;
  padding: 0.42rem 0.75rem;
  background: var(--accent);
  color: white;
  font: inherit;
  cursor: pointer;
}

.reset-view {
  position: absolute;
  top: 0.75rem;
  left: 0.75rem;
  z-index: 2;
  background: color-mix(in srgb, var(--surface) 88%, transparent);
  color: var(--ink);
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
