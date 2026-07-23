<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue';

const props = withDefaults(
  defineProps<{
    open?: boolean;
    title?: string;
    lead?: string;
    steps?: string[];
    pathHint?: string;
  }>(),
  {
    open: false,
    title: '다운로드 방법',
    lead: '',
    steps: () => [],
    pathHint: '',
  },
);

const emit = defineEmits<{
  close: [];
}>();

function onKeydown(e: KeyboardEvent) {
  if (!props.open) return;
  if (e.key === 'Escape') emit('close');
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown);
  if (typeof document !== 'undefined') {
    document.body.style.overflow = '';
  }
});

watch(
  () => props.open,
  (open) => {
    if (typeof document === 'undefined') return;
    document.body.style.overflow = open ? 'hidden' : '';
  },
);
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="guide"
      role="dialog"
      aria-modal="true"
      aria-labelledby="download-guide-title"
      @click.self="emit('close')"
    >
      <div class="guide__panel">
        <h2 id="download-guide-title" class="guide__title">{{ title }}</h2>
        <p v-if="lead" class="guide__lead">{{ lead }}</p>
        <ol v-if="steps.length" class="guide__steps">
          <li v-for="(step, i) in steps" :key="i">{{ step }}</li>
        </ol>
        <p v-if="pathHint" class="guide__path" aria-hidden="true">
          {{ pathHint }}
        </p>
        <div class="guide__actions">
          <button type="button" class="guide__btn" @click="emit('close')">
            확인
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.guide {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: grid;
  place-items: center;
  padding: 1.25rem;
  background: rgb(0 0 0 / 45%);
}

.guide__panel {
  width: min(420px, 100%);
  padding: 1.25rem 1.35rem 1.1rem;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--ink);
  box-shadow: 0 12px 40px rgb(0 0 0 / 18%);
}

.guide__title {
  margin: 0 0 0.5rem;
  font-size: 1.1rem;
  font-weight: 650;
}

.guide__lead {
  margin: 0 0 0.85rem;
  font-size: 0.9rem;
  color: var(--ink-soft);
  line-height: 1.45;
}

.guide__steps {
  margin: 0 0 0.85rem;
  padding-left: 1.2rem;
  font-size: 0.9rem;
  line-height: 1.55;
  color: var(--ink);
}

.guide__steps li + li {
  margin-top: 0.35rem;
}

.guide__path {
  margin: 0 0 1.1rem;
  padding: 0.55rem 0.7rem;
  border-radius: 6px;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 0.82rem;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.guide__actions {
  display: flex;
  justify-content: flex-end;
}

.guide__btn {
  font: inherit;
  font-size: 0.88rem;
  font-weight: 600;
  padding: 0.45rem 1rem;
  border-radius: 6px;
  border: none;
  background: var(--accent);
  color: #fff;
  cursor: pointer;
}

.guide__btn:hover {
  filter: brightness(1.05);
}
</style>
