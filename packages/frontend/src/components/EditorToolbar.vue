<script setup lang="ts">
import { computed } from 'vue';
import DesktopWindowControls from '@/components/DesktopWindowControls.vue';
import {
  formatFilenameWithStatus,
  type DocumentSaveStatus,
} from '@/composables/usePageTitle';

const props = withDefaults(
  defineProps<{
    filename: string;
    saveStatus?: DocumentSaveStatus;
    saveLabel?: string;
    showSave?: boolean;
    showExportActions?: boolean;
    showFilename?: boolean;
    busy?: boolean;
  }>(),
  {
    saveStatus: 'pristine',
    saveLabel: '다운로드',
    showSave: true,
    showExportActions: false,
    showFilename: true,
    busy: false,
  },
);

const displayFilename = computed(() =>
  formatFilenameWithStatus(props.filename, props.saveStatus),
);

const emit = defineEmits<{
  open: [];
  save: [];
  exportSvg: [];
  exportPng: [];
  close: [];
}>();

function confirmIfModified(): boolean {
  if (props.saveStatus !== 'modified') return true;
  return window.confirm('저장하지 않은 수정이 있습니다. 저장하지 않고 계속할까요?');
}

function onRequestHome() {
  if (!confirmIfModified()) return;
  emit('close');
}
</script>

<template>
  <header class="toolbar">
    <div class="toolbar__left">
      <button
        type="button"
        class="toolbar__btn"
        :disabled="busy"
        @click="$emit('open')"
      >
        열기
      </button>
      <button
        v-if="showSave"
        type="button"
        class="toolbar__btn"
        data-save-button
        :disabled="busy"
        @click="$emit('save')"
      >
        {{ saveLabel }}
      </button>
      <button
        v-if="showExportActions"
        type="button"
        class="toolbar__btn"
        :disabled="busy"
        @click="$emit('exportSvg')"
      >
        SVG
      </button>
      <button
        v-if="showExportActions"
        type="button"
        class="toolbar__btn"
        :disabled="busy"
        @click="$emit('exportPng')"
      >
        PNG
      </button>
    </div>
    <p
      class="toolbar__title"
      :title="showFilename ? displayFilename : undefined"
      :aria-hidden="!showFilename"
    >
      {{ showFilename ? displayFilename : '' }}
    </p>
    <div class="toolbar__right">
      <RouterLink
        class="toolbar__icon-link"
        to="/licenses"
        title="오픈소스 라이선스"
        aria-label="라이선스"
      >
        <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="8" cy="8" r="6" />
          <path d="M8 7.2v3.6M8 4.9h.01" />
        </svg>
      </RouterLink>
      <DesktopWindowControls
        :before-close-app="confirmIfModified"
        @home="onRequestHome"
      />
    </div>
  </header>
</template>

<style scoped>
.toolbar {
  flex: 0 0 auto;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 0.5rem;
  min-height: 40px;
  padding: 0.35rem 0.75rem;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
  z-index: 2;
  user-select: none;
  -webkit-app-region: drag;
}

.toolbar__left {
  display: flex;
  gap: 0.4rem;
  justify-self: start;
  max-width: 100%;
  overflow-x: auto;
  scrollbar-width: none;
}

.toolbar__left::-webkit-scrollbar {
  display: none;
}

.toolbar__right {
  display: flex;
  gap: 2px;
  align-items: center;
  justify-self: end;
}

.toolbar__title {
  margin: 0;
  max-width: min(40vw, 28rem);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: center;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--ink);
}

.toolbar__btn {
  border: 1px solid var(--border);
  padding: 0.3rem 0.7rem;
  border-radius: 4px;
  font-weight: 600;
  font-size: 0.8rem;
  cursor: pointer;
  font-family: inherit;
  background: var(--surface);
  color: var(--ink);
  -webkit-app-region: no-drag;
}

.toolbar__btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.toolbar__btn:disabled {
  opacity: 0.55;
  cursor: wait;
}

.toolbar__icon-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 26px;
  border-radius: 4px;
  color: var(--ink);
  opacity: 0.75;
  text-decoration: none;
  transition: background-color 0.12s ease, opacity 0.12s ease;
  -webkit-app-region: no-drag;
}

.toolbar__icon-link:hover {
  opacity: 1;
  background: color-mix(in srgb, var(--ink) 8%, transparent);
}

@media (max-width: 640px) {
  .toolbar {
    grid-template-columns: minmax(0, 1fr) auto;
    min-height: 48px;
    padding: 0.4rem 0.55rem;
  }

  .toolbar__title {
    display: none;
  }

  .toolbar__link {
    display: none;
  }

  .toolbar__btn {
    min-height: 2.5rem;
    padding: 0.4rem 0.75rem;
  }
}
</style>
