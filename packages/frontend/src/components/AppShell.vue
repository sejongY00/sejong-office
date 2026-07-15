<script setup lang="ts">
import AppFooter from './AppFooter.vue';

withDefaults(
  defineProps<{
    /** Editor pages: fill viewport, compact footer */
    compactFooter?: boolean;
  }>(),
  { compactFooter: false },
);
</script>

<template>
  <div class="shell" :class="{ 'shell--editor': compactFooter }">
    <div class="shell__main">
      <slot />
    </div>
    <AppFooter :compact="compactFooter" />
  </div>
</template>

<style scoped>
.shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.shell--editor {
  height: 100vh;
  max-height: 100vh;
  overflow: hidden;
}

.shell__main {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
</style>
