<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    /** Show the '홈' button before window controls in desktop mode. */
    showHome?: boolean;
    /** Show the close (go home) icon button when running in a standard web browser. */
    showBrowserClose?: boolean;
    /** Optional custom handler before quitting the app (e.g. unsaved changes check). */
    beforeCloseApp?: () => boolean | Promise<boolean>;
  }>(),
  {
    showHome: true,
    showBrowserClose: true,
    beforeCloseApp: undefined,
  },
);

const emit = defineEmits<{
  home: [];
}>();

const isDesktop = computed(() => Boolean(window.sejongDesktop));

function onHome() {
  emit('home');
}

function onMinimize() {
  void window.sejongDesktop?.minimizeWindow?.();
}

function onToggleMaximize() {
  void window.sejongDesktop?.toggleMaximizeWindow?.();
}

async function onCloseApp() {
  if (props.beforeCloseApp) {
    const allowed = await props.beforeCloseApp();
    if (!allowed) return;
  }
  void window.sejongDesktop?.closeApp?.();
}
</script>

<template>
  <div v-if="isDesktop" class="win-controls" role="group" aria-label="창 제어" @mousedown.stop>
    <button
      v-if="showHome"
      type="button"
      class="win-controls__btn"
      data-win-action="home"
      title="홈으로 이동"
      aria-label="홈"
      @click="onHome"
    >
      <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M2.5 6.8L8 2.2l5.5 4.6v6.2a1 1 0 0 1-1 1h-3v-4h-3v4h-3a1 1 0 0 1-1-1V6.8z" />
      </svg>
    </button>
    <button
      type="button"
      class="win-controls__btn"
      data-win-action="minimize"
      title="창 최소화"
      aria-label="최소화"
      @click="onMinimize"
    >
      <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true">
        <path d="M3.5 8h9" />
      </svg>
    </button>
    <button
      type="button"
      class="win-controls__btn"
      data-win-action="maximize"
      title="창 최대화 / 복원"
      aria-label="최대화"
      @click="onToggleMaximize"
    >
      <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true">
        <rect x="3.5" y="3.5" width="9" height="9" rx="1" />
      </svg>
    </button>
    <button
      type="button"
      class="win-controls__btn win-controls__btn--close"
      data-win-action="close"
      title="앱 종료"
      aria-label="닫기"
      @click="onCloseApp"
    >
      <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true">
        <path d="M4 4l8 8M12 4l-8 8" />
      </svg>
    </button>
  </div>
  <button
    v-else-if="showBrowserClose"
    type="button"
    class="win-controls__btn"
    data-win-action="browser-close"
    title="닫기"
    aria-label="닫기"
    @click="onHome"
  >
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true">
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  </button>
</template>

<style scoped>
.win-controls {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  -webkit-app-region: no-drag;
}

.win-controls__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 26px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 4px;
  cursor: pointer;
  background: transparent;
  color: var(--ink);
  opacity: 0.82;
  transition:
    background-color 0.12s ease,
    border-color 0.12s ease,
    color 0.12s ease,
    opacity 0.12s ease;
  -webkit-app-region: no-drag;
}

.win-controls__btn svg {
  display: block;
  pointer-events: none;
}

.win-controls__btn:hover {
  opacity: 1;
  background: color-mix(in srgb, var(--ink) 8%, transparent);
}

.win-controls__btn--close:hover {
  opacity: 1;
  border-color: #e81123;
  background: #e81123;
  color: #ffffff;
}
</style>
