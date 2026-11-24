<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import DesktopWindowControls from '@/components/DesktopWindowControls.vue';
import UpdateBanner from '@/components/UpdateBanner.vue';
import { useOpenDocument } from '@/composables/useOpenDocument';
import {
  bindSessionPageHideOnce,
  hwpOpenToken,
} from '@/composables/useSessionLifecycle';
import { hasAnyUnsavedChanges } from '@/composables/useUnsavedGuard';
import { desktopLaunchQueue, registerFileLaunch } from '@/pwa/fileLaunch';

bindSessionPageHideOnce();

const route = useRoute();
const router = useRouter();
const { error: launchError, openDocument } = useOpenDocument();

// When launched via OS double-click (`/?launch=1`), cover Home immediately with the same loading
// screen as Office/RHWP editors so the Home view never flashes before navigation.
const launchingFile = ref(
  typeof window !== 'undefined' &&
    Boolean(window.sejongDesktop) &&
    new URLSearchParams(window.location.search).get('launch') === '1',
);

const showLaunchOverlay = computed(
  () => launchingFile.value && (!route.name || route.name === 'home'),
);

function clearLaunchOverlay(stripQuery = false) {
  launchingFile.value = false;
  if (stripQuery && route.name === 'home' && route.query.launch) {
    void router.replace({ name: 'home' });
  }
}

let stopUnsavedListener: (() => void) | undefined;

onMounted(() => {
  stopUnsavedListener = window.sejongDesktop?.onCheckUnsavedChanges?.(() =>
    hasAnyUnsavedChanges(),
  );
  registerFileLaunch(
    desktopLaunchQueue(window.sejongDesktop, {
      onIncoming: () => {
        if (!route.name || route.name === 'home') {
          launchingFile.value = true;
        }
      },
      onInitialEmpty: () => {
        clearLaunchOverlay(true);
      },
    }) ?? window.launchQueue,
    async (files) => {
      try {
        await router.isReady();
        const opened = await openDocument(files);
        if (!opened) {
          clearLaunchOverlay(true);
          if (launchError.value) {
            window.alert(launchError.value);
          }
        } else {
          launchingFile.value = false;
        }
      } catch (err) {
        clearLaunchOverlay(true);
        throw err;
      }
    },
    (err) => {
      clearLaunchOverlay(true);
      window.alert(
        `파일을 열 수 없습니다: ${err instanceof Error ? err.message : String(err)}`,
      );
    },
  );
});

onUnmounted(() => {
  stopUnsavedListener?.();
  stopUnsavedListener = undefined;
});

/** Keep editor instances alive when visiting /licenses etc. */
const viewKey = computed(() => {
  // `d` changes on every staged office file so the view remounts with the new document.
  if (route.name === 'office-editor') {
    return `office-${String(route.query.d ?? '')}`;
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
    route.name === 'illustrator-viewer' ||
    route.name === 'photoshop-viewer' ||
    route.name === 'markdown-viewer' ||
    route.name === 'tools-scanner' ||
    route.name === 'tools-bg-remove' ||
    route.name === 'tools-image-edit'
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
        'OfficeEditorView',
        'ExcalidrawEditorView',
        'MermaidEditorView',
        'DrawioEditorView',
        'CadViewerView',
        'Model3DViewerView',
        'IllustratorViewerView',
        'PhotoshopViewerView',
        'MarkdownViewerView',
        'ToolsScannerView',
        'ToolsBgRemoveView',
        'ToolsImageEditView',
      ]"
      :max="10"
    >
      <component :is="Component" :key="viewKey" />
    </KeepAlive>
  </RouterView>
  <div v-if="showLaunchOverlay" class="launch-overlay">
    <div class="launch-overlay__bar">
      <DesktopWindowControls
        :show-browser-close="false"
        @home="clearLaunchOverlay(true)"
      />
    </div>
    <div class="launch-overlay__body" role="status" aria-live="polite">
      <span>편집기를 불러오는 중…</span>
      <progress />
    </div>
  </div>
  <UpdateBanner />
</template>

<style scoped>
.launch-overlay {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  flex-direction: column;
  background: var(--canvas);
}

.launch-overlay__bar {
  flex: 0 0 auto;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding: 0.35rem 0.75rem;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
  -webkit-app-region: drag;
}

.launch-overlay__bar:empty {
  display: none;
}

.launch-overlay__body {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  color: var(--ink);
  font-size: 0.85rem;
}

.launch-overlay__body progress {
  width: min(16rem, calc(100% - 2rem));
  accent-color: var(--accent);
}
</style>
