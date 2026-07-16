<script setup lang="ts">
import { computed } from 'vue';
import {
  ICON_COLORS,
  ICON_PATHS,
  iconKindForExtension,
} from '@/config/favicons';

const props = withDefaults(
  defineProps<{
    extension: string;
    size?: number;
  }>(),
  { size: 40 },
);

const kind = computed(() => iconKindForExtension(props.extension.toLowerCase()));
</script>

<template>
  <svg
    class="ft-icon"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    :width="size"
    :height="size"
    aria-hidden="true"
  >
    <path :fill="ICON_COLORS[kind]" :d="ICON_PATHS[kind]" />
  </svg>
</template>

<style scoped>
.ft-icon {
  flex-shrink: 0;
  display: block;
}
</style>
