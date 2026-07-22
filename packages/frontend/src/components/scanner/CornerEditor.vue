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

const LOUPE_SIZE = 128;
const LOUPE_ZOOM = 2.8;

/** 드래그 중인 코너 반대편에 루페를 두어 손가락에 가리지 않게 함 */
const LOUPE_CORNER: Record<
  keyof CornerPoints,
  { x: 'left' | 'right'; y: 'top' | 'bottom' }
> = {
  topLeftCorner: { x: 'right', y: 'bottom' },
  topRightCorner: { x: 'left', y: 'bottom' },
  bottomRightCorner: { x: 'left', y: 'top' },
  bottomLeftCorner: { x: 'right', y: 'top' },
};

const host = ref<HTMLElement | null>(null);
const imageEl = ref<HTMLImageElement | null>(null);
const display = ref({ width: 0, height: 0, naturalWidth: 1, naturalHeight: 1 });
const dragging = ref<keyof CornerPoints | null>(null);

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

const loupeStyle = computed(() => {
  const key = dragging.value;
  if (!key || display.value.width < 8) return null;

  const point = props.corners[key];
  const anchor = LOUPE_CORNER[key];
  const margin = 10;
  const left =
    anchor.x === 'left' ? margin : display.value.width - LOUPE_SIZE - margin;
  const top =
    anchor.y === 'top' ? margin : display.value.height - LOUPE_SIZE - margin;

  return {
    width: `${LOUPE_SIZE}px`,
    height: `${LOUPE_SIZE}px`,
    left: `${left}px`,
    top: `${top}px`,
    backgroundImage: `url(${props.imageUrl})`,
    backgroundRepeat: 'no-repeat',
    backgroundSize: `${display.value.naturalWidth * LOUPE_ZOOM}px ${display.value.naturalHeight * LOUPE_ZOOM}px`,
    backgroundPosition: `${LOUPE_SIZE / 2 - point.x * LOUPE_ZOOM}px ${LOUPE_SIZE / 2 - point.y * LOUPE_ZOOM}px`,
  };
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
  dragging.value = key;
  (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
  event.preventDefault();
}

function onPointerMove(event: PointerEvent) {
  if (!dragging.value || !imageEl.value) return;
  const rect = imageEl.value.getBoundingClientRect();
  const nextPoint = clamp({
    x: (event.clientX - rect.left) / scaleX.value,
    y: (event.clientY - rect.top) / scaleY.value,
  });
  emit('update:corners', {
    ...props.corners,
    [dragging.value]: nextPoint,
  });
}

function onPointerUp() {
  dragging.value = null;
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
      :class="{ 'is-active': dragging === handle.key }"
      :style="{ left: `${handle.left}px`, top: `${handle.top}px` }"
      :disabled="disabled"
      :aria-label="handle.key"
      @pointerdown="onPointerDown(handle.key, $event)"
    />
    <div
      v-if="loupeStyle"
      class="corner-editor__loupe"
      :style="loupeStyle"
      aria-hidden="true"
    >
      <span class="corner-editor__loupe-cross" />
    </div>
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

.corner-editor__handle.is-active {
  transform: scale(1.15);
  cursor: grabbing;
}

.corner-editor__handle:disabled {
  opacity: 0.5;
  cursor: default;
}

.corner-editor__loupe {
  position: absolute;
  z-index: 3;
  box-sizing: border-box;
  border: 2px solid white;
  border-radius: 50%;
  box-shadow:
    0 0 0 1px color-mix(in srgb, black 35%, transparent),
    0 10px 28px color-mix(in srgb, black 28%, transparent);
  pointer-events: none;
  overflow: hidden;
  background-color: color-mix(in srgb, var(--bg, #111) 80%, black);
}

.corner-editor__loupe-cross {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.corner-editor__loupe-cross::before,
.corner-editor__loupe-cross::after {
  content: '';
  position: absolute;
  background: color-mix(in srgb, white 88%, transparent);
  box-shadow: 0 0 0 0.5px color-mix(in srgb, black 40%, transparent);
}

.corner-editor__loupe-cross::before {
  left: 50%;
  top: 18%;
  bottom: 18%;
  width: 1.5px;
  transform: translateX(-50%);
}

.corner-editor__loupe-cross::after {
  top: 50%;
  left: 18%;
  right: 18%;
  height: 1.5px;
  transform: translateY(-50%);
}

@media (max-width: 900px) {
  .corner-editor__image {
    max-height: min(52vh, 520px);
  }

  .corner-editor__handle {
    width: 28px;
    height: 28px;
    margin: -14px 0 0 -14px;
  }
}
</style>
