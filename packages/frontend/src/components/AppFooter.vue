<script setup lang="ts">
import { APP_GIT_URL, APP_DISPLAY_NAME } from '@/config/app';

withDefaults(
  defineProps<{
    compact?: boolean;
  }>(),
  { compact: false },
);
</script>

<template>
  <footer class="footer" :class="{ 'footer--compact': compact }">
    <div class="footer__inner">
      <span class="footer__brand">{{ APP_DISPLAY_NAME }}</span>
      <nav class="footer__nav" aria-label="부가 링크">
        <a
          v-if="APP_GIT_URL"
          class="footer__link"
          :href="APP_GIT_URL"
          target="_blank"
          rel="noopener noreferrer"
        >
          소스 코드
        </a>
        <RouterLink class="footer__link" to="/licenses">
          오픈소스 라이선스
        </RouterLink>
      </nav>
    </div>
  </footer>
</template>

<style scoped>
.footer {
  flex: 0 0 auto;
  margin-top: auto;
  border-top: 1px solid var(--border);
  background: color-mix(in srgb, var(--surface) 85%, transparent);
  backdrop-filter: blur(8px);
}

.footer--compact .footer__inner {
  padding: 0.4rem 1rem;
}

.footer__inner {
  max-width: 960px;
  margin: 0 auto;
  padding: 1rem 1.25rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 1.5rem;
  align-items: center;
  justify-content: space-between;
}

.footer--compact .footer__inner {
  max-width: none;
}

.footer__brand {
  font-size: 0.85rem;
  color: var(--muted);
  font-weight: 500;
}

.footer--compact .footer__brand,
.footer--compact .footer__link {
  font-size: 0.75rem;
}

.footer__nav {
  display: flex;
  gap: 1.25rem;
}

.footer__link {
  font-size: 0.85rem;
  color: var(--ink);
  text-decoration: none;
  border-bottom: 1px solid transparent;
  transition:
    border-color 0.2s ease,
    color 0.2s ease;
}

.footer__link:hover {
  border-bottom-color: var(--accent);
  color: var(--accent);
}
</style>
