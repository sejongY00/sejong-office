<script setup lang="ts">
import AppShell from '@/components/AppShell.vue';
import { usePageTitle } from '@/composables/usePageTitle';

defineOptions({ name: 'NotFoundView' });

usePageTitle('페이지를 찾을 수 없음');
</script>

<template>
  <AppShell>
    <main class="not-found">
      <h1 class="not-found__title">페이지를 찾을 수 없습니다</h1>
      <p class="not-found__lead">주소가 바뀌었거나 잘못 입력된 것 같습니다.</p>
      <RouterLink class="not-found__home" :to="{ name: 'home' }">홈으로 가기</RouterLink>
    </main>
  </AppShell>
</template>

<style scoped>
.not-found {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 3rem 1.25rem;
  text-align: center;
}

.not-found__title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.35rem;
  font-weight: 600;
  color: var(--ink);
}

.not-found__lead {
  margin: 0;
  font-size: 0.92rem;
  color: var(--muted);
}

.not-found__home {
  margin-top: 0.5rem;
  padding: 0.55rem 1.1rem;
  border-radius: 6px;
  background: var(--accent);
  color: #fff;
  font-size: 0.9rem;
  font-weight: 600;
  text-decoration: none;
}

.not-found__home:hover {
  filter: brightness(1.08);
}
</style>
