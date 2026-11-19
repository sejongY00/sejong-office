<script setup lang="ts">
import { applyUpdate, updateReady } from '@/pwa/serviceWorkerUpdates';

// Hidden for this visit only; the update still applies once every tab is closed.
function dismiss() {
  updateReady.value = false;
}
</script>

<template>
  <div v-if="updateReady" class="update" role="status" aria-live="polite">
    <span class="update__text">새 버전이 있습니다. 저장한 뒤 새로고침하세요.</span>
    <button type="button" class="update__primary" @click="applyUpdate">새로고침</button>
    <button type="button" class="update__later" @click="dismiss">나중에</button>
  </div>
</template>

<style scoped>
.update {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 1000;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem 0.75rem;
  max-width: calc(100vw - 32px);
  padding: 0.7rem 0.9rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--card);
  box-shadow: 0 6px 24px rgb(0 0 0 / 18%);
  color: var(--ink);
  font-size: 0.88rem;
}

.update button {
  padding: 0.35rem 0.75rem;
  border-radius: 6px;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.update__primary {
  border: 0;
  background: var(--accent);
  color: #fff;
}

.update__later {
  border: 1px solid var(--border);
  background: transparent;
  color: var(--muted);
}
</style>
