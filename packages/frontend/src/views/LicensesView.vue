<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import { useRouter } from 'vue-router';
import gplLicenseRaw from '../../../../LICENSE?raw';
import thirdPartyNoticesRaw from '../../../../THIRD-PARTY-NOTICES.md?raw';
import AppShell from '@/components/AppShell.vue';
import DesktopWindowControls from '@/components/DesktopWindowControls.vue';
import { usePageTitle } from '@/composables/usePageTitle';
import { APP_DISPLAY_NAME, APP_GIT_URL, APP_NAME } from '@/config/app';
import {
  renderMarkdown,
  resolveMarkdownRelativeLinks,
} from '@/integrations/markdown/render';

const router = useRouter();
usePageTitle('오픈소스 라이선스');

const repoBaseUrl = APP_GIT_URL.replace(/\/+$/, '');
const licenseFileUrl = repoBaseUrl ? `${repoBaseUrl}/blob/main/LICENSE` : '';
const thirdPartyNoticesUrl = repoBaseUrl
  ? `${repoBaseUrl}/blob/main/THIRD-PARTY-NOTICES.md`
  : '';

const noticesHtml = computed(() => {
  const rewritten = resolveMarkdownRelativeLinks(thirdPartyNoticesRaw, {
    repoBaseUrl,
    overrides: {
      './LICENSE': '#gpl-license',
    },
  });
  return renderMarkdown(rewritten);
});

const gplOpen = ref(false);
const gplDetailsRef = ref<HTMLDetailsElement | null>(null);

const thirdPartyText = ref('');
const thirdPartyLoading = ref(false);
const thirdPartyError = ref('');

function onGplToggle(event: Event) {
  gplOpen.value = (event.target as HTMLDetailsElement).open;
}

async function onNoticesClick(event: MouseEvent) {
  const target = event.target as HTMLElement | null;
  const anchor = target?.closest('a[href="#gpl-license"]');
  if (!anchor) return;
  event.preventDefault();
  gplOpen.value = true;
  await nextTick();
  gplDetailsRef.value?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
}

async function onThirdPartyToggle(event: Event) {
  const isOpen = (event.target as HTMLDetailsElement).open;
  if (!isOpen || thirdPartyText.value || thirdPartyLoading.value) return;

  thirdPartyLoading.value = true;
  thirdPartyError.value = '';
  try {
    const base = import.meta.env.BASE_URL || '/';
    const url = `${base.endsWith('/') ? base : `${base}/`}THIRD-PARTY-LICENSES.txt`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    thirdPartyText.value = await response.text();
  } catch (reason) {
    thirdPartyError.value =
      reason instanceof Error
        ? `라이선스 전문을 불러오지 못했습니다: ${reason.message}`
        : '라이선스 전문을 불러오지 못했습니다.';
  } finally {
    thirdPartyLoading.value = false;
  }
}
</script>

<template>
  <AppShell>
    <div class="licenses__topbar">
      <div class="licenses__top">
        <RouterLink class="back" to="/" title="홈으로 이동" aria-label="홈으로 이동">
          <svg
            viewBox="0 0 16 16"
            width="15"
            height="15"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M10 3.5L5.5 8l4.5 4.5" />
          </svg>
        </RouterLink>
        <DesktopWindowControls
          :show-browser-close="false"
          @home="router.push({ name: 'home' })"
        />
      </div>
    </div>
    <main class="licenses">
      <header class="licenses__header">
        <h1>오픈소스 라이선스 · 고지</h1>
        <p>
          {{ APP_DISPLAY_NAME }}({{ APP_NAME }})의 라이선스 및 포함된 서드파티
          소프트웨어·글꼴·상표권 고지 사항입니다.
        </p>
      </header>

      <section class="card">
        <h2>본 앱 및 원문 저장소</h2>
        <p>라이선스: <strong>GNU General Public License v3.0 only</strong></p>
        <template v-if="APP_GIT_URL">
          <p>
            소스 코드:
            <a :href="APP_GIT_URL" target="_blank" rel="noopener noreferrer">{{
              APP_GIT_URL
            }}</a>
          </p>
          <p>
            GitHub 원문:
            <a :href="licenseFileUrl" target="_blank" rel="noopener noreferrer"
              >LICENSE (GPL-3.0 전문)</a
            >
            ·
            <a
              :href="thirdPartyNoticesUrl"
              target="_blank"
              rel="noopener noreferrer"
              >THIRD-PARTY-NOTICES.md</a
            >
          </p>
        </template>
        <p v-else class="muted">
          소스 저장소 URL은 <code>APP_GIT_URL</code> 상수에 설정할 수 있습니다.
        </p>
      </section>

      <section class="card">
        <article
          class="notices-md"
          v-html="noticesHtml"
          @click="onNoticesClick"
        />
      </section>

      <section class="card">
        <details
          id="gpl-license"
          ref="gplDetailsRef"
          class="license-details"
          :open="gplOpen"
          @toggle="onGplToggle"
        >
          <summary>GNU General Public License v3.0 전문 (LICENSE)</summary>
          <pre class="license-text">{{ gplLicenseRaw }}</pre>
        </details>
      </section>

      <section class="card">
        <details
          id="third-party-licenses"
          class="license-details"
          @toggle="onThirdPartyToggle"
        >
          <summary>
            서드파티 패키지 라이선스·고지 전문 (THIRD-PARTY-LICENSES.txt)
          </summary>
          <p v-if="thirdPartyLoading" class="muted">
            서드파티 라이선스 전문을 불러오는 중입니다…
          </p>
          <p v-else-if="thirdPartyError" class="license-error" role="alert">
            {{ thirdPartyError }}
          </p>
          <pre v-else-if="thirdPartyText" class="license-text">{{
            thirdPartyText
          }}</pre>
        </details>
      </section>
    </main>
  </AppShell>
</template>

<style scoped>
.licenses__topbar {
  position: sticky;
  top: 0;
  z-index: 20;
  width: 100%;
  min-height: 40px;
  padding: 0.35rem 0.75rem;
  background: color-mix(in srgb, var(--canvas) 92%, transparent);
  backdrop-filter: blur(8px);
  user-select: none;
  -webkit-app-region: drag;
}

.licenses {
  flex: 1;
  width: min(860px, 100%);
  margin: 0 auto;
  padding: 0.5rem 1.25rem 3rem;
}

.licenses__header h1 {
  font-family: var(--font-display);
  font-size: 1.85rem;
  margin: 0.25rem 0 0.5rem;
}

.licenses__header p {
  color: var(--muted);
  margin: 0 0 1.5rem;
  line-height: 1.5;
}

.licenses__top {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.back {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 26px;
  border-radius: 4px;
  color: var(--ink);
  opacity: 0.82;
  text-decoration: none;
  transition: background-color 0.12s ease, opacity 0.12s ease;
  -webkit-app-region: no-drag;
}

.back:hover {
  opacity: 1;
  background: color-mix(in srgb, var(--ink) 8%, transparent);
}

.card {
  padding: 1.25rem 0;
  border-top: 1px solid var(--border);
}

.card h2 {
  font-size: 1.1rem;
  margin: 0 0 0.65rem;
}

.card p,
.card li {
  font-size: 0.92rem;
  line-height: 1.55;
  color: var(--ink-soft);
}

.card a {
  color: var(--accent);
}

.muted {
  color: var(--muted) !important;
  font-size: 0.85rem !important;
}

code {
  font-size: 0.85em;
  background: var(--accent-soft);
  padding: 0.1em 0.35em;
  border-radius: 3px;
}

.notices-md {
  color: var(--ink-soft);
  font-size: 0.92rem;
  line-height: 1.6;
  overflow-wrap: break-word;
}

.notices-md :deep(:first-child) {
  margin-top: 0;
}

.notices-md :deep(h1) {
  font-size: 1.3rem;
  color: var(--ink);
  margin: 0 0 0.75rem;
}

.notices-md :deep(h2) {
  font-size: 1.08rem;
  color: var(--ink);
  margin: 1.5rem 0 0.6rem;
}

.notices-md :deep(h3) {
  font-size: 0.98rem;
  color: var(--ink);
  margin: 1.15rem 0 0.45rem;
}

.notices-md :deep(p),
.notices-md :deep(ul),
.notices-md :deep(ol),
.notices-md :deep(table) {
  margin: 0 0 0.9rem;
}

.notices-md :deep(ul),
.notices-md :deep(ol) {
  padding-left: 1.25rem;
}

.notices-md :deep(a) {
  color: var(--accent);
}

.notices-md :deep(hr) {
  border: 0;
  border-top: 1px solid var(--border);
  margin: 1.25rem 0;
}

.notices-md :deep(code) {
  font-size: 0.84em;
  background: var(--accent-soft);
  padding: 0.1em 0.35em;
  border-radius: 3px;
}

.notices-md :deep(table) {
  display: block;
  width: 100%;
  overflow-x: auto;
  border-collapse: collapse;
  font-size: 0.86rem;
}

.notices-md :deep(th),
.notices-md :deep(td) {
  padding: 0.45rem 0.65rem;
  border: 1px solid var(--border);
  text-align: left;
  vertical-align: top;
}

.notices-md :deep(th) {
  background: var(--surface);
  color: var(--ink);
  font-weight: 600;
  white-space: nowrap;
}

.license-details summary {
  cursor: pointer;
  font-weight: 600;
  font-size: 0.98rem;
  color: var(--ink);
  list-style-position: outside;
}

.license-details[open] summary {
  margin-bottom: 0.85rem;
}

.license-text {
  margin: 0;
  padding: 0.9rem 1rem;
  max-height: 28rem;
  overflow: auto;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
  color: var(--ink-soft);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.78rem;
  line-height: 1.5;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.license-error {
  color: #b42318 !important;
  font-size: 0.86rem !important;
}
</style>
