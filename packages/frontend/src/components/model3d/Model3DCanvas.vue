<script setup lang="ts">
import {
  Box3,
  Clock,
  Color,
  DirectionalLight,
  GridHelper,
  Group,
  HemisphereLight,
  MathUtils,
  Object3D,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
  AnimationMixer,
  AxesHelper,
  Mesh,
  Material,
  Texture,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue';
import { loadModelFiles } from '@/integrations/model3d/loadModel';
import type {
  ModelStats,
  ModelTreeNode,
} from '@/integrations/model3d/types';
import type { SystemTheme } from '@/composables/useSystemTheme';

const props = defineProps<{
  files: readonly File[];
  theme: SystemTheme;
}>();

const emit = defineEmits<{
  progress: [value: number, label: string];
  loaded: [stats: ModelStats, tree: ModelTreeNode];
  error: [message: string];
}>();

const host = ref<HTMLElement | null>(null);
const scene = new Scene();
const camera = new PerspectiveCamera(45, 1, 0.01, 100000);
const content = new Group();
const clock = new Clock();
let renderer: WebGLRenderer | null = null;
let controls: OrbitControls | null = null;
let resizeObserver: ResizeObserver | null = null;
let animationFrame = 0;
let mixer: AnimationMixer | null = null;
let abortController: AbortController | null = null;
let loadSequence = 0;

scene.add(content);
scene.add(new HemisphereLight(0xffffff, 0x334155, 2.1));
const keyLight = new DirectionalLight(0xffffff, 2.4);
keyLight.position.set(6, 10, 8);
scene.add(keyLight);
scene.add(new GridHelper(20, 20, 0x7a8794, 0xb8c0c8));
scene.add(new AxesHelper(2));

function disposeMaterial(material: Material) {
  for (const value of Object.values(material)) {
    if (value instanceof Texture) value.dispose();
  }
  material.dispose();
}

function disposeObject(object: Object3D) {
  object.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    child.geometry.dispose();
    const materials = Array.isArray(child.material)
      ? child.material
      : [child.material];
    materials.forEach(disposeMaterial);
  });
}

function clearContent() {
  mixer?.stopAllAction();
  mixer = null;
  for (const child of [...content.children]) {
    content.remove(child);
    disposeObject(child);
  }
}

function resize() {
  if (!renderer || !host.value) return;
  const width = Math.max(1, host.value.clientWidth);
  const height = Math.max(1, host.value.clientHeight);
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function fitCamera() {
  if (!controls || !content.children.length) return;
  const box = new Box3().setFromObject(content);
  if (box.isEmpty()) return;
  const center = box.getCenter(new Vector3());
  const size = box.getSize(new Vector3());
  const maxSize = Math.max(size.x, size.y, size.z, 0.01);
  const distance =
    maxSize /
    (2 * Math.tan(MathUtils.degToRad(camera.fov * 0.5)));
  const direction = new Vector3(1, 0.75, 1).normalize();
  camera.position.copy(center).addScaledVector(direction, distance * 1.65);
  camera.near = Math.max(maxSize / 10000, 0.001);
  camera.far = Math.max(maxSize * 1000, 1000);
  camera.updateProjectionMatrix();
  controls.target.copy(center);
  controls.update();
}

function renderLoop() {
  animationFrame = requestAnimationFrame(renderLoop);
  mixer?.update(clock.getDelta());
  controls?.update();
  if (renderer) renderer.render(scene, camera);
}

async function load(files: readonly File[]) {
  const sequence = ++loadSequence;
  abortController?.abort();
  abortController = new AbortController();
  clearContent();
  if (!files.length) return;

  try {
    const loaded = await loadModelFiles(
      files,
      (value, label) => emit('progress', value, label),
      abortController.signal,
    );
    if (sequence !== loadSequence) {
      disposeObject(loaded.object);
      return;
    }
    content.add(loaded.object);
    if (loaded.animations.length) {
      mixer = new AnimationMixer(loaded.object);
      loaded.animations.forEach((clip) => mixer?.clipAction(clip).play());
    }
    await nextTick();
    fitCamera();
    emit('loaded', loaded.stats, loaded.tree);
  } catch (reason) {
    if (reason instanceof DOMException && reason.name === 'AbortError') return;
    emit(
      'error',
      reason instanceof Error
        ? reason.message
        : '3D 모델을 열지 못했습니다.',
    );
  }
}

watch(
  () => props.files,
  (files) => {
    void load(files);
  },
);

watch(
  () => props.theme,
  (theme) => {
    scene.background = new Color(theme === 'dark' ? 0x161a1d : 0xf2f2f2);
  },
  { immediate: true },
);

onMounted(() => {
  if (!host.value) return;
  renderer = new WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = 'srgb';
  host.value.append(renderer.domElement);
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host.value);
  resize();
  renderLoop();
  void load(props.files);
});

onBeforeUnmount(() => {
  loadSequence += 1;
  abortController?.abort();
  cancelAnimationFrame(animationFrame);
  resizeObserver?.disconnect();
  clearContent();
  controls?.dispose();
  renderer?.dispose();
  renderer?.forceContextLoss();
  renderer?.domElement.remove();
  renderer = null;
  controls = null;
});

defineExpose({ fitCamera });
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
