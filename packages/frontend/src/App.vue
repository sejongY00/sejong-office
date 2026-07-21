<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { bindSessionPageHideOnce } from '@/composables/useSessionLifecycle';

bindSessionPageHideOnce();

const route = useRoute();

/** Keep editor instances alive when visiting /licenses etc. */
const viewKey = computed(() => {
  if (route.name === 'onlyoffice-editor') {
    return `onlyoffice-${route.params.docId}`;
  }
  if (route.name === 'rhwp-editor') {
    return 'rhwp-editor';
  }
  if (
    route.name === 'excalidraw-editor' ||
    route.name === 'mermaid-editor' ||
    route.name === 'drawio-editor'
  ) {
    return String(route.name);
  }
  return String(route.fullPath);
});
</script>

<template>
  <RouterView v-slot="{ Component }">
    <KeepAlive
      :include="[
        'OnlyOfficeEditorView',
        'RhwpEditorView',
        'ExcalidrawEditorView',
        'MermaidEditorView',
        'DrawioEditorView',
      ]"
      :max="8"
    >
      <component :is="Component" :key="viewKey" />
    </KeepAlive>
  </RouterView>
</template>
