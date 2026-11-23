<script setup lang="ts">
import { computed } from 'vue';
import {
  DOC_FOLD_COLORS,
  DOCUMENT_SHEET_KINDS,
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
const isDocSheet = computed(() => DOCUMENT_SHEET_KINDS.has(kind.value));
const foldColor = computed(() => DOC_FOLD_COLORS[kind.value] ?? '#d0e4f7');
const mark = computed(() => ICON_MARK_PATHS[kind.value]);
const boxStyle = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
}));
</script>

<template>
  <span class="ft-icon" :style="boxStyle" aria-hidden="true">
    <!-- Style 1: OS native document sheet + format badge for Office/PDF/CSV/HWP -->
    <svg
      v-if="isDocSheet"
      class="ft-icon__svg"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 256 256"
    >
      <path
        d="M56 20 H164 L212 68 V220 A16 16 0 0 1 196 236 H56 A16 16 0 0 1 40 220 V36 A16 16 0 0 1 56 20 Z"
        fill="#ffffff"
      />
      <path
        d="M164 20 V56 A12 12 0 0 0 176 68 H212 Z"
        :fill="foldColor"
      />
      <path
        d="M56 20 H164 L212 68 V220 A16 16 0 0 1 196 236 H56 A16 16 0 0 1 40 220 V36 A16 16 0 0 1 56 20 Z"
        fill="none"
        stroke="#d0d7de"
        stroke-width="6"
        stroke-linejoin="round"
      />
      <rect
        x="64"
        y="88"
        width="128"
        height="92"
        rx="16"
        :fill="ICON_COLORS[kind]"
      />
      <template v-if="kind === 'hwp'">
        <rect x="123" y="98" width="10" height="9" fill="#ffffff" />
        <rect x="104" y="105" width="48" height="8" fill="#ffffff" />
        <circle cx="128" cy="128" r="12" fill="none" stroke="#ffffff" stroke-width="7.5" />
        <circle cx="128" cy="151" r="4.5" fill="#ffffff" />
        <path d="M104 150 V168 H152 V160 H112 V150 Z" fill="#ffffff" />
      </template>
      <g v-else-if="mark" transform="translate(80, 86) scale(4)">
        <path fill="#ffffff" fill-rule="evenodd" :d="mark" />
      </g>
      <rect x="68" y="198" width="120" height="10" rx="5" fill="#94a3b8" />
    </svg>
    <!-- Tool / Viewer / Diagram icons -->
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

.ft-icon__svg {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
