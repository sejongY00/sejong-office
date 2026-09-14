<script setup lang="ts">
import { computed, onBeforeUnmount } from 'vue';
import {
  clampCrop,
  type PixelRect,
} from '@/integrations/imageedit/process';

defineOptions({ name: 'CropEditor' });

const props = defineProps<{
  src: string;
  crop: PixelRect;
  imageWidth: number;
  imageHeight: number;
  aspect: number | null;
}>();

const emit = defineEmits<{
  'update:crop': [PixelRect];
}>();

type Handle = 'move' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

const handles = computed<Handle[]>(() =>
  props.aspect
    ? ['nw', 'ne', 'se', 'sw']
    : ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'],
);

const boxStyle = computed(() => {
  const w = props.imageWidth || 1;
  const h = props.imageHeight || 1;
  return {
    left: `${(props.crop.x / w) * 100}%`,
    top: `${(props.crop.y / h) * 100}%`,
    width: `${(props.crop.width / w) * 100}%`,
    height: `${(props.crop.height / h) * 100}%`,
  };
});

let drag: {
  handle: Handle;
  pointerId: number;
  startX: number;
  startY: number;
  start: PixelRect;
  displayScale: number;
} | null = null;

function displayScaleFromEvent(event: PointerEvent) {
  const stage = (event.currentTarget as HTMLElement).closest('.crop');
  const img = stage?.querySelector('img');
  if (!img || !props.imageWidth) return 1;
  return img.clientWidth / props.imageWidth;
}

function bindWindow(on: boolean) {
  if (on) {
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
  } else {
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', endDrag);
    window.removeEventListener('pointercancel', endDrag);
  }
}

function beginDrag(handle: Handle, event: PointerEvent) {
  event.preventDefault();
  event.stopPropagation();
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  bindWindow(false);
  drag = {
    handle,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    start: { ...props.crop },
    displayScale: displayScaleFromEvent(event),
  };
  bindWindow(true);
}

function applyAspectFromFixedCorner(
  next: PixelRect,
  fixed: { x: number; y: number },
  preferWidth: boolean,
) {
  const aspect = props.aspect;
  if (!aspect) return next;
  if (preferWidth) {
    next.height = next.width / aspect;
  } else {
    next.width = next.height * aspect;
  }
  next.x = fixed.x < next.x + next.width ? fixed.x : fixed.x - next.width;
  next.y = fixed.y < next.y + next.height ? fixed.y : fixed.y - next.height;
  if (next.width < 0) {
    next.x += next.width;
    next.width = Math.abs(next.width);
  }
  if (next.height < 0) {
    next.y += next.height;
    next.height = Math.abs(next.height);
  }
  return next;
}

function onPointerMove(event: PointerEvent) {
  if (!drag || event.pointerId !== drag.pointerId) return;
  const scale = drag.displayScale || 1;
  const dx = (event.clientX - drag.startX) / scale;
  const dy = (event.clientY - drag.startY) / scale;
  const start = drag.start;
  let next: PixelRect = { ...start };
  const handle = drag.handle;
  const aspect = props.aspect;

  if (handle === 'move') {
    next.x = start.x + dx;
    next.y = start.y + dy;
    emit(
      'update:crop',
      clampCrop(next, props.imageWidth, props.imageHeight),
    );
    return;
  }

  const se = { x: start.x + start.width, y: start.y + start.height };
  const nw = { x: start.x, y: start.y };

  if (handle.includes('e') || handle === 'e') next.width = start.width + dx;
  if (handle.includes('s') || handle === 's') next.height = start.height + dy;
  if (handle.includes('w') || handle === 'w') {
    next.x = start.x + dx;
    next.width = start.width - dx;
  }
  if (handle.includes('n') || handle === 'n') {
    next.y = start.y + dy;
    next.height = start.height - dy;
  }

  if (aspect) {
    if (handle === 'se') {
      next = applyAspectFromFixedCorner(next, nw, Math.abs(dx) >= Math.abs(dy));
      next.x = nw.x;
      next.y = nw.y;
    } else if (handle === 'nw') {
      next = applyAspectFromFixedCorner(next, se, Math.abs(dx) >= Math.abs(dy));
      next.x = se.x - next.width;
      next.y = se.y - next.height;
    } else if (handle === 'ne') {
      const fixed = { x: start.x, y: se.y };
      next = applyAspectFromFixedCorner(next, fixed, Math.abs(dx) >= Math.abs(dy));
      next.x = start.x;
      next.y = se.y - next.height;
    } else if (handle === 'sw') {
      const fixed = { x: se.x, y: start.y };
      next = applyAspectFromFixedCorner(next, fixed, Math.abs(dx) >= Math.abs(dy));
      next.x = se.x - next.width;
      next.y = start.y;
    }
  }

  emit('update:crop', clampCrop(next, props.imageWidth, props.imageHeight));
}

function endDrag(event: PointerEvent) {
  if (!drag || event.pointerId !== drag.pointerId) return;
  drag = null;
  bindWindow(false);
}

onBeforeUnmount(() => bindWindow(false));
</script>

<template>
  <div class="crop">
    <img :src="src" alt="편집할 이미지" draggable="false" />
    <div class="crop__shade" aria-hidden="true" />
    <div
      class="crop__box"
      :style="boxStyle"
      @pointerdown="beginDrag('move', $event)"
    >
      <span
        v-for="handle in handles"
        :key="handle"
        class="crop__handle"
        :class="`crop__handle--${handle}`"
        @pointerdown="beginDrag(handle, $event)"
      />
    </div>
  </div>
</template>

<style scoped>
.crop {
  position: relative;
  display: inline-block;
  max-width: 100%;
  line-height: 0;
  overflow: hidden;
  touch-action: none;
  user-select: none;
}

.crop img {
  display: block;
  max-width: 100%;
  max-height: min(70vh, 44rem);
  width: auto;
  height: auto;
}

.crop__shade {
  pointer-events: none;
  position: absolute;
  inset: 0;
}

.crop__box {
  position: absolute;
  box-sizing: border-box;
  border: 2px solid var(--accent);
  box-shadow: 0 0 0 9999px rgb(0 0 0 / 42%);
  cursor: move;
}

.crop__handle {
  position: absolute;
  width: 0.8rem;
  height: 0.8rem;
  background: var(--surface);
  border: 2px solid var(--accent);
  border-radius: 1px;
  box-sizing: border-box;
}

.crop__handle--nw {
  left: -0.4rem;
  top: -0.4rem;
  cursor: nwse-resize;
}
.crop__handle--ne {
  right: -0.4rem;
  top: -0.4rem;
  cursor: nesw-resize;
}
.crop__handle--se {
  right: -0.4rem;
  bottom: -0.4rem;
  cursor: nwse-resize;
}
.crop__handle--sw {
  left: -0.4rem;
  bottom: -0.4rem;
  cursor: nesw-resize;
}
.crop__handle--n {
  left: 50%;
  top: -0.4rem;
  transform: translateX(-50%);
  cursor: ns-resize;
}
.crop__handle--s {
  left: 50%;
  bottom: -0.4rem;
  transform: translateX(-50%);
  cursor: ns-resize;
}
.crop__handle--e {
  right: -0.4rem;
  top: 50%;
  transform: translateY(-50%);
  cursor: ew-resize;
}
.crop__handle--w {
  left: -0.4rem;
  top: 50%;
  transform: translateY(-50%);
  cursor: ew-resize;
}
</style>
