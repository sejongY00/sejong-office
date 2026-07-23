<script setup lang="ts">
import { computed } from 'vue';
import {
  HWP_ICON_URL,
  ICON_COLORS,
  ICON_MARK_PATHS,
  ICON_PATHS,
  iconKindForExtension,
} from '@/config/favicons';

const props = withDefaults(
  defineProps<{
    extension: string;
    size?: number;
  }>(),
  { size: 36 },
);

const kind = computed(() => iconKindForExtension(props.extension.toLowerCase()));
const mark = computed(() => ICON_MARK_PATHS[kind.value]);
const boxStyle = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
}));
</script>

<template>
  <span class="ft-icon" :style="boxStyle" aria-hidden="true">
    <img
      v-if="kind === 'hwp'"
      class="ft-icon__img"
      :src="HWP_ICON_URL"
      alt=""
      draggable="false"
    />
    <svg
      v-else
      class="ft-icon__svg"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
    >
      <path :fill="ICON_COLORS[kind]" :d="ICON_PATHS[kind]" />
      <path
        v-if="mark"
        fill="#ffffff"
        fill-rule="evenodd"
        :d="mark"
      />
    </svg>
  </span>
</template>

<style scoped>
.ft-icon {
  flex-shrink: 0;
  display: inline-grid;
  place-items: center;
  box-sizing: border-box;
  overflow: hidden;
  border-radius: 4px;
  line-height: 0;
}

.ft-icon__svg,
.ft-icon__img {
  display: block;
  width: 100%;
  height: 100%;
}

/* Raster HWP logo is full-bleed; match SVG document inset (~3/24). */
.ft-icon__img {
  object-fit: contain;
  padding: 12.5%;
  box-sizing: border-box;
}
</style>
