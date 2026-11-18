<script setup lang="ts">
defineEmits<{ reload: []; keep: [] }>();
</script>

<template>
  <div class="file-changed" role="alert">
    <span>다른 곳에서 파일이 수정됐습니다. 다시 불러오면 여기서 저장하지 않은 수정은 사라집니다.</span>
    <button type="button" class="file-changed__btn file-changed__btn--primary" @click="$emit('reload')">
      다시 불러오기
    </button>
    <button type="button" class="file-changed__btn" @click="$emit('keep')">무시</button>
  </div>
</template>

<style scoped>
.file-changed {
  flex: 0 0 auto;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  padding: 0.45rem 0.75rem;
  border-bottom: 1px solid color-mix(in srgb, var(--accent) 35%, var(--border));
  background: var(--accent-soft);
  color: var(--ink);
  font-size: 0.8rem;
}

.file-changed span {
  flex: 1 1 16rem;
}

.file-changed__btn {
  padding: 0.25rem 0.7rem;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
  color: var(--ink);
  font: inherit;
  cursor: pointer;
}

.file-changed__btn--primary {
  border-color: var(--accent);
  background: var(--accent);
  color: var(--surface);
}
</style>
