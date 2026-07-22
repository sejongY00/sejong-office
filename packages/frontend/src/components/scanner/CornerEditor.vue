<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { CornerPoints, Point2D } from '@/integrations/scanner/types';

const props = defineProps<{
  imageUrl: string;
  corners: CornerPoints;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  'update:corners': [value: CornerPoints];
}>();

const host = ref<HTMLElement | null>(null);
const imageEl = ref<HTMLImageElement | null>(null);
const display = ref({ width: 0, height: 0, naturalWidth: 1, naturalHeight: 1 });
let dragging: keyof CornerPoints | null = null;

const scaleX = computed(
  () => display.value.width / Math.max(1, display.value.naturalWidth),
);
const scaleY = computed(
  () => display.value.height / Math.max(1, display.value.naturalHeight),
);

const handles = computed(() =>
  (Object.keys(props.corners) as (keyof CornerPoints)[]).map((key) => {
    const point = props.corners[key];
    return {
      key,
      left: point.x * scaleX.value,
      top: point.y * scaleY.value,
    };
  }),
);

const polygonPoints = computed(() => {
  const order: (keyof CornerPoints)[] = [
    'topLeftCorner',
    'topRightCorner',
    'bottomRightCorner',
    'bottomLeftCorner',
  ];
  return order
    .map((key) => {
      const point = props.corners[key];
      return `${point.x * scaleX.value},${point.y * scaleY.value}`;
    })
    .join(' ');
});

function measure() {
  if (!host.value || !imageEl.value) return;
  const rect = imageEl.value.getBoundingClientRect();
  display.value = {
    width: rect.width,
    height: rect.height,
    naturalWidth: imageEl.value.naturalWidth || 1,
    naturalHeight: imageEl.value.naturalHeight || 1,
  };
}

function clamp(point: Point2D): Point2D {
  return {
    x: Math.min(display.value.naturalWidth, Math.max(0, point.x)),
    y: Math.min(display.value.naturalHeight, Math.max(0, point.y)),
  };
}

function onPointerDown(key: keyof CornerPoints, event: PointerEvent) {
  if (props.disabled) return;
  dragging = key;
  (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
  event.preventDefault();
}

function onPointerMove(event: PointerEvent) {
  if (!dragging || !imageEl.value) return;
  const rect = imageEl.value.getBoundingClientRect();
  const nextPoint = clamp({
    x: (event.clientX - rect.left) / scaleX.value,
    y: (event.clientY - rect.top) / scaleY.value,
  });
  emit('update:corners', {
    ...props.corners,
    [dragging]: nextPoint,
  });
}

function onPointerUp() {
  dragging = null;
}

onMounted(() => {
  measure();
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('resize', measure);
});

onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onPointerMove);
  window.removeEventListener('pointerup', onPointerUp);
  window.removeEventListener('resize', measure);
});

watch(
  () => props.imageUrl,
  async () => {
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    measure();
  },
);
</script>

<template>
  <div ref="host" class="corner-editor">
    <img
      ref="imageEl"
      class="corner-editor__image"
      :src="imageUrl"
      alt="스캔 원본"
      draggable="false"
      @load="measure"
    />
    <svg class="corner-editor__overlay" aria-hidden="true">
      <polygon :points="polygonPoints" />
    </svg>
    <button
      v-for="handle in handles"
      :key="handle.key"
      type="button"
      class="corner-editor__handle"
      :style="{ left: `${handle.left}px`, top: `${handle.top}px` }"
      :disabled="disabled"
      :aria-label="handle.key"
      @pointerdown="onPointerDown(handle.key, $event)"
    />
  </div>
</template>

<style scoped>
.corner-editor {
  position: relative;
  display: inline-block;
  max-width: 100%;
  max-height: 100%;
  touch-action: none;
  user-select: none;
}

.corner-editor__image {
  display: block;
  max-width: 100%;
  max-height: min(62vh, 720px);
  object-fit: contain;
}

.corner-editor__overlay {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.corner-editor__overlay polygon {
  fill: color-mix(in srgb, var(--accent) 18%, transparent);
  stroke: var(--accent);
  stroke-width: 2;
}

.corner-editor__handle {
  position: absolute;
  z-index: 2;
  width: 18px;
  height: 18px;
  margin: -9px 0 0 -9px;
  border: 2px solid white;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 0 1px color-mix(in srgb, black 25%, transparent);
  cursor: grab;
  touch-action: none;
}

.corner-editor__handle:active {
  cursor: grabbing;
}

.corner-editor__handle:disabled {
  opacity: 0.5;
  cursor: default;
}
</style>
