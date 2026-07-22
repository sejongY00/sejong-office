<script setup lang="ts">
import {
  BufferGeometry,
  Float32BufferAttribute,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  SphereGeometry,
  Vector3,
} from 'three';
import {
  nextTick,
  onActivated,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue';
import type { SystemTheme } from '@/composables/useSystemTheme';
import {
  importErrorMessage,
  O3DV_ENV_MAP,
  OV,
  summarizeModel,
  treeFromModel,
} from '@/integrations/model3d/o3dv';
import type {
  ModelPropertyGroup,
  ModelStats,
  ModelTreeNode,
} from '@/integrations/model3d/types';
import {
  meshInstancePropertyGroups,
  modelPropertyGroups,
} from '@/integrations/model3d/o3dv';

const props = defineProps<{
  files: readonly File[];
  theme: SystemTheme;
  edges: boolean;
  projection: 'perspective' | 'orthographic';
  upAxis: 'y' | 'z';
  measureMode: boolean;
  hiddenKeys: ReadonlySet<string>;
  hiddenVersion: number;
  selectedKey: string | null;
}>();

const emit = defineEmits<{
  progress: [value: number, label: string];
  loaded: [
    stats: ModelStats,
    tree: ModelTreeNode,
    modelGroups: ModelPropertyGroup[],
    missingFiles: string[],
  ];
  error: [message: string];
  selectMainFile: [fileNames: string[], select: (index: number) => void];
  select: [key: string | null, groups: ModelPropertyGroup[]];
  measure: [distance: number | null];
}>();

const host = ref<HTMLElement | null>(null);

let viewer: OV.Viewer | null = null;
let loader: OV.ThreeModelLoader | null = null;
let model: OV.Model | null = null;
let canvas: HTMLCanvasElement | null = null;
let resizeObserver: ResizeObserver | null = null;
let loadSequence = 0;
let measurePoints: Vector3[] = [];
let measureObjects: Object3D[] = [];

function resize() {
  if (!viewer || !host.value) return;
  viewer.Resize(
    Math.max(1, host.value.clientWidth),
    Math.max(1, host.value.clientHeight),
  );
}

function applyTheme(theme: SystemTheme) {
  if (!viewer) return;
  if (theme === 'dark') {
    viewer.SetBackgroundColor(new OV.RGBAColor(22, 26, 29, 255));
  } else {
    viewer.SetBackgroundColor(new OV.RGBAColor(242, 242, 242, 255));
  }
}

function applyEnvironment() {
  if (!viewer) return;
  viewer.SetEnvironmentMapSettings(
    new OV.EnvironmentSettings([...O3DV_ENV_MAP], false),
  );
}

function applyEdges(enabled: boolean) {
  if (!viewer) return;
  viewer.SetEdgeSettings(
    new OV.EdgeSettings(enabled, new OV.RGBColor(0, 0, 0), 15),
  );
}

function applyProjection(mode: 'perspective' | 'orthographic') {
  if (!viewer) return;
  viewer.SetProjectionMode(
    mode === 'orthographic'
      ? OV.ProjectionMode.Orthographic
      : OV.ProjectionMode.Perspective,
  );
}

function applyUp(axis: 'y' | 'z') {
  if (!viewer) return;
  viewer.SetUpVector(axis === 'z' ? OV.Direction.Z : OV.Direction.Y, true);
}

function fitCamera() {
  if (!viewer || !model) return;
  const sphere = viewer.GetBoundingSphere(() => true);
  if (!sphere) return;
  viewer.AdjustClippingPlanesToSphere(sphere);
  viewer.FitSphereToWindow(sphere, true);
}

function clearMeasure() {
  measurePoints = [];
  measureObjects = [];
  viewer?.ClearExtra();
  emit('measure', null);
}

function addMeasureMarker(point: Vector3, color: number) {
  if (!viewer) return;
  const geometry = new SphereGeometry(Math.max(point.length() * 0.008, 0.01), 16, 16);
  const material = new MeshBasicMaterial({ color });
  const mesh = new Mesh(geometry, material);
  mesh.position.copy(point);
  viewer.AddExtraObject(mesh);
  measureObjects.push(mesh);
}

function addMeasureLine(a: Vector3, b: Vector3) {
  if (!viewer) return;
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    'position',
    new Float32BufferAttribute([a.x, a.y, a.z, b.x, b.y, b.z], 3),
  );
  const line = new Line(
    geometry,
    new LineBasicMaterial({ color: 0xe53935 }),
  );
  viewer.AddExtraObject(line);
  measureObjects.push(line);
}

function applyVisibility() {
  if (!viewer) return;
  viewer.SetMeshesVisibility((userData: {
    originalMeshInstance?: OV.MeshInstance;
  }) => {
    const key = userData.originalMeshInstance?.GetId()?.GetKey();
    if (!key) return true;
    return !props.hiddenKeys.has(key);
  });
}

function applyHighlight() {
  if (!viewer) return;
  viewer.SetMeshesHighlight(new OV.RGBColor(255, 200, 0), (userData: {
    originalMeshInstance?: OV.MeshInstance;
  }) => {
    const key = userData.originalMeshInstance?.GetId()?.GetKey();
    return Boolean(key && key === props.selectedKey);
  });
}

function selectByKey(key: string | null) {
  if (!model) {
    emit('select', null, []);
    return;
  }
  const groups = key
    ? meshInstancePropertyGroups(model, key)
    : modelPropertyGroups(model);
  emit('select', key, groups);
}

function onMouseClick(_button: number, mouseCoords: { x: number; y: number }) {
  if (!viewer || !model) return;

  if (props.measureMode) {
    const hit = viewer.GetMeshIntersectionUnderMouse(
      OV.IntersectionMode.MeshOnly,
      mouseCoords,
    );
    if (!hit?.point) return;
    const point = new Vector3(hit.point.x, hit.point.y, hit.point.z);
    if (measurePoints.length >= 2) clearMeasure();
    measurePoints.push(point);
    addMeasureMarker(point, measurePoints.length === 1 ? 0x1e88e5 : 0xe53935);
    if (measurePoints.length === 2) {
      addMeasureLine(measurePoints[0], measurePoints[1]);
      emit(
        'measure',
        OV.CoordDistance3D(
          new OV.Coord3D(
            measurePoints[0].x,
            measurePoints[0].y,
            measurePoints[0].z,
          ),
          new OV.Coord3D(
            measurePoints[1].x,
            measurePoints[1].y,
            measurePoints[1].z,
          ),
        ),
      );
    }
    return;
  }

  const userData = viewer.GetMeshUserDataUnderMouse(
    OV.IntersectionMode.MeshOnly,
    mouseCoords,
  );
  const key = userData?.originalMeshInstance?.GetId()?.GetKey() ?? null;
  selectByKey(key);
}

async function load(files: readonly File[]) {
  const sequence = ++loadSequence;
  if (!viewer || !loader) return;
  clearMeasure();
  model = null;
  viewer.Clear();
  if (!files.length) return;

  const inputFiles = OV.InputFilesFromFileObjects([...files]);
  const settings = new OV.ImportSettings();

  loader.LoadModel(inputFiles, settings, {
    onLoadStart: () => emit('progress', 0.05, '모델 준비 중'),
    onFileListProgress: (current: number, total: number) => {
      emit('progress', total ? current / total * 0.35 : 0.2, `파일 ${current}/${total}`);
    },
    onFileLoadProgress: (current: number, total: number) => {
      emit(
        'progress',
        0.35 + (total ? (current / total) * 0.25 : 0.1),
        `읽는 중 ${current}/${total}`,
      );
    },
    onImportStart: () => emit('progress', 0.65, '가져오는 중'),
    onSelectMainFile: (fileNames: string[], selectFile: (index: number) => void) => {
      emit('selectMainFile', fileNames, selectFile);
    },
    onVisualizationStart: () => emit('progress', 0.8, '시각화 중'),
    onTextureLoaded: () => viewer?.Render(),
    onModelFinished: (importResult: OV.ImportResult, threeObject: unknown) => {
      if (sequence !== loadSequence) return;
      viewer?.SetMainObject(threeObject);
      model = importResult.model;
      applyVisibility();
      applyHighlight();
      applyEdges(props.edges);
      applyProjection(props.projection);
      applyUp(props.upAxis);
      void nextTick(() => {
        fitCamera();
        emit('progress', 1, '모델 준비 완료');
        emit(
          'loaded',
          summarizeModel(importResult.model),
          treeFromModel(importResult.model),
          modelPropertyGroups(importResult.model),
          importResult.missingFiles ?? [],
        );
        selectByKey(null);
      });
    },
    onLoadError: (importError: OV.ImportError) => {
      if (sequence !== loadSequence) return;
      emit('error', importErrorMessage(importError));
    },
  });
}

function screenshot() {
  if (!viewer || !host.value) return null;
  return viewer.GetImageAsDataUrl(
    Math.max(1, host.value.clientWidth * 2),
    Math.max(1, host.value.clientHeight * 2),
    false,
  );
}

function getModel() {
  return model;
}

watch(
  () => props.files,
  (files) => {
    void load(files);
  },
);

watch(
  () => props.theme,
  (theme) => applyTheme(theme),
);

watch(
  () => props.edges,
  (value) => applyEdges(value),
);

watch(
  () => props.projection,
  (value) => applyProjection(value),
);

watch(
  () => props.upAxis,
  (value) => applyUp(value),
);

watch(
  () => props.measureMode,
  (enabled) => {
    if (!enabled) clearMeasure();
  },
);

watch(
  () => props.hiddenVersion,
  () => applyVisibility(),
);

watch(
  () => props.selectedKey,
  () => applyHighlight(),
);

onMounted(() => {
  if (!host.value) return;
  canvas = document.createElement('canvas');
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  host.value.append(canvas);

  viewer = new OV.Viewer();
  viewer.Init(canvas);
  loader = new OV.ThreeModelLoader();
  applyTheme(props.theme);
  applyEnvironment();
  applyEdges(props.edges);
  applyProjection(props.projection);
  viewer.SetMouseClickHandler(onMouseClick);

  resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host.value);
  resize();
  void load(props.files);
});

onActivated(() => {
  resize();
  viewer?.Render();
});

onBeforeUnmount(() => {
  loadSequence += 1;
  resizeObserver?.disconnect();
  clearMeasure();
  loader?.Destroy();
  viewer?.Destroy();
  canvas?.remove();
  loader = null;
  viewer = null;
  canvas = null;
  model = null;
});

defineExpose({
  fitCamera,
  screenshot,
  getModel,
  clearMeasure,
  selectByKey,
});
</script>

<template>
  <div ref="host" class="model-canvas" aria-label="3D 모델 뷰어" />
</template>

<style scoped>
.model-canvas {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.model-canvas :deep(canvas) {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
