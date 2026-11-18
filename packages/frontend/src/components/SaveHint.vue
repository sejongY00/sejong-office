<script setup lang="ts">
import { nextTick, onUnmounted, ref, watch } from 'vue';

// Points at the toolbar's Save button after a file opens: the editors' own save/download menus
// only download a new copy, so Save up here is the way to write back to the opened file.

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();

const SKIP_KEY = 'sejong-office:save-hint-off';
const canSaveInPlace = 'showSaveFilePicker' in window;

const rect = ref<DOMRect | null>(null);
const cardLeft = ref(12);
const skip = ref(false);

function measure() {
  // The toolbar row scrolls horizontally, so a popover inside it would be clipped; find the button
  // and draw over the page instead.
  rect.value = document.querySelector('[data-save-button]')?.getBoundingClientRect() ?? null;
  if (!rect.value) return;
  // Same width as the CSS (min(22rem, 100vw - 24px)); keep the card on screen on narrow phones.
  const cardWidth = Math.min(352, window.innerWidth - 24);
  cardLeft.value = Math.min(Math.max(12, rect.value.left), window.innerWidth - cardWidth - 12);
}

function hidden(): boolean {
  try {
    return sessionStorage.getItem(SKIP_KEY) === '1';
  } catch {
    return false;
  }
}

function close() {
  if (skip.value) {
    try {
      sessionStorage.setItem(SKIP_KEY, '1');
    } catch {
      // Storage blocked: it simply shows again next time.
    }
  }
  emit('close');
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') close();
}

const shown = ref(false);

function listen(on: boolean) {
  if (on) {
    window.addEventListener('resize', measure);
    window.addEventListener('keydown', onKeydown);
  } else {
    window.removeEventListener('resize', measure);
    window.removeEventListener('keydown', onKeydown);
  }
}

watch(
  () => props.open,
  async (open) => {
    if (open && hidden()) {
      emit('close');
      return;
    }
    shown.value = open;
    listen(open);
    if (!open) return;
    skip.value = false;
    await nextTick();
    measure();
  },
  { immediate: true },
);

onUnmounted(() => listen(false));
</script>

<template>
  <Teleport to="body">
    <div v-if="shown" class="save-hint" role="dialog" aria-modal="true" aria-labelledby="save-hint-title" @click.self="close">
      <div
        v-if="rect"
        class="save-hint__ring"
        :style="{
          left: `${rect.left - 4}px`,
          top: `${rect.top - 4}px`,
          width: `${rect.width + 8}px`,
          height: `${rect.height + 8}px`,
        }"
        aria-hidden="true"
      />
      <div
        class="save-hint__card"
        :style="rect ? { left: `${cardLeft}px`, top: `${rect.bottom + 16}px` } : undefined"
        :class="{ 'save-hint__card--center': !rect }"
      >
        <span
          v-if="rect"
          class="save-hint__arrow"
          :style="{ left: `${rect.left + rect.width / 2 - cardLeft - 9}px` }"
          aria-hidden="true"
        />
        <h2 id="save-hint-title" class="save-hint__title">저장은 이 [저장] 버튼으로 하세요</h2>
        <p v-if="canSaveInPlace" class="save-hint__text">
          [저장]을 눌러야 연 파일에 그대로 저장됩니다. 편집기 안의 저장·다운로드 메뉴는 파일을 새로
          내려받기만 해요.
        </p>
        <p v-else class="save-hint__text">
          [저장]을 눌러 수정한 파일을 내려받으세요. 이 브라우저에서는 연 파일에 바로 덮어쓸 수
          없어요.
        </p>
        <div class="save-hint__actions">
          <label class="save-hint__skip">
            <input v-model="skip" type="checkbox" />
            닫을 때까지 다시 보지 않기
          </label>
          <button type="button" class="save-hint__btn" @click="close">확인</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.save-hint {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgb(0 0 0 / 45%);
}

.save-hint__ring {
  position: fixed;
  border: 3px solid var(--accent);
  border-radius: 8px;
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 30%, transparent);
  animation: save-hint-pulse 1.4s ease-in-out infinite;
  pointer-events: none;
}

.save-hint__card {
  position: fixed;
  width: min(22rem, calc(100vw - 24px));
  padding: 1rem 1.1rem 0.9rem;
  border-radius: 10px;
  background: var(--surface);
  color: var(--ink);
  box-shadow: 0 12px 32px rgb(0 0 0 / 25%);
}

.save-hint__card--center {
  left: 50%;
  top: 20%;
  transform: translateX(-50%);
}

.save-hint__arrow {
  position: absolute;
  top: -9px;
  width: 18px;
  height: 18px;
  background: var(--surface);
  transform: rotate(45deg);
  border-radius: 3px 0 0 0;
}

.save-hint__title {
  margin: 0 0 0.4rem;
  font-size: 0.95rem;
}

.save-hint__text {
  margin: 0;
  font-size: 0.85rem;
  line-height: 1.5;
  color: var(--muted);
}

.save-hint__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-top: 0.9rem;
}

.save-hint__skip {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.8rem;
  color: var(--muted);
  cursor: pointer;
}

.save-hint__btn {
  padding: 0.35rem 1rem;
  border: 1px solid var(--accent);
  border-radius: 6px;
  background: var(--accent);
  color: var(--surface);
  font: inherit;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
}

@keyframes save-hint-pulse {
  50% {
    box-shadow: 0 0 0 9px color-mix(in srgb, var(--accent) 12%, transparent);
  }
}

@media (prefers-reduced-motion: reduce) {
  .save-hint__ring {
    animation: none;
  }
}
</style>
