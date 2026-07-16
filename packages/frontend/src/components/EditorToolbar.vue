<script setup lang="ts">
defineProps<{
  filename: string;
}>();

defineEmits<{
  open: [];
  save: [];
  close: [];
}>();
</script>

<template>
  <header class="toolbar">
    <div class="toolbar__left">
      <button type="button" class="toolbar__btn" @click="$emit('open')">
        열기
      </button>
      <button type="button" class="toolbar__btn" @click="$emit('save')">
        저장
      </button>
    </div>
    <p class="toolbar__title" :title="filename">{{ filename }}</p>
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

.toolbar__link {
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--muted);
  text-decoration: none;
}

.toolbar__link:hover {
  color: var(--accent);
}
</style>
