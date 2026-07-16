<script setup lang="ts">
withDefaults(
  defineProps<{
    /** Editor pages: fill viewport, no scroll */
    editor?: boolean;
  }>(),
  { editor: false },
);
</script>

<template>
  <div class="shell" :class="{ 'shell--editor': editor }">
    <div class="shell__main">
      <slot />
    </div>
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
