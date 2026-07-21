<script setup lang="ts">
withDefaults(
  defineProps<{
    filename: string;
    saveLabel?: string;
    showSave?: boolean;
    showExportActions?: boolean;
    showFilename?: boolean;
    busy?: boolean;
  }>(),
  {
    saveLabel: '저장',
    showSave: true,
    showExportActions: false,
    showFilename: true,
    busy: false,
  },
);

defineEmits<{
  open: [];
  save: [];
  exportSvg: [];
  exportPng: [];
  close: [];
}>();
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
      :title="showFilename ? filename : undefined"
      :aria-hidden="!showFilename"
    >
      {{ showFilename ? filename : '' }}
    </p>
    <div class="toolbar__right">
      <RouterLink class="toolbar__link" to="/licenses">라이선스</RouterLink>
      <button type="button" class="toolbar__btn" @click="$emit('close')">
        닫기
      </button>
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
  gap: 0.65rem;
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
}

.toolbar__btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.toolbar__btn:disabled {
  opacity: 0.55;
  cursor: wait;
}

.toolbar__link {
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--muted);
  text-decoration: none;
}

.toolbar__link:hover {
  color: var(--accent);
}

@media (max-width: 640px) {
  .toolbar {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .toolbar__title {
    display: none;
  }
}
</style>
