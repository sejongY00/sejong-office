<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import {
  bindSessionPageHideOnce,
  hwpOpenToken,
} from '@/composables/useSessionLifecycle';

bindSessionPageHideOnce();

const route = useRoute();

/** Keep editor instances alive when visiting /licenses etc. */
const viewKey = computed(() => {
  if (route.name === 'onlyoffice-editor') {
    return `onlyoffice-${route.params.docId}`;
  }
  // Token changes on every staged HWP open so the view remounts with the new file.
  if (route.name === 'rhwp-editor') {
    return `rhwp-${hwpOpenToken()}`;
  }
  if (
    route.name === 'excalidraw-editor' ||
    route.name === 'mermaid-editor' ||
    route.name === 'drawio-editor' ||
    route.name === 'cad-viewer' ||
    route.name === 'model3d-viewer' ||
    route.name === 'tools-scanner' ||
    route.name === 'tools-bg-remove'
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
        'ExcalidrawEditorView',
        'MermaidEditorView',
        'DrawioEditorView',
        'CadViewerView',
        'Model3DViewerView',
        'ToolsScannerView',
        'ToolsBgRemoveView',
      ]"
      :max="10"
    >
      <component :is="Component" :key="viewKey" />
    </KeepAlive>
  </RouterView>
</template>
