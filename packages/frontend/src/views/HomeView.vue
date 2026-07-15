<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import AppShell from '@/components/AppShell.vue';
import { APP_DISPLAY_NAME, isHwp, isOffice } from '@/config/app';
import { createSession, uploadDocument } from '@/api/client';
import { storeHwpFile } from '@/composables/useSessionLifecycle';

const router = useRouter();
const dragging = ref(false);
const error = ref('');
const busy = ref(false);

async function handleFile(file: File | undefined) {
  if (!file || busy.value) return;
  error.value = '';
  busy.value = true;

  try {
    if (isHwp(file.name)) {
      await storeHwpFile(file);
      await createSession().catch(() => undefined);
      await router.push({ name: 'rhwp-editor' });
      return;
    }

    if (!isOffice(file.name)) {
      error.value =
        '지원하지 않는 형식입니다. docx, xlsx, pptx, pdf, hwp, hwpx 등을 올려 주세요.';
      return;
    }

    await createSession();
    const { docId } = await uploadDocument(file);
    await router.push({ name: 'onlyoffice-editor', params: { docId } });
  } catch (err) {
    error.value =
      err instanceof Error ? err.message : '파일을 열 수 없습니다.';
  } finally {
    busy.value = false;
  }
}

function onDrop(e: DragEvent) {
  dragging.value = false;
  const file = e.dataTransfer?.files?.[0];
  void handleFile(file);
}

function onInput(e: Event) {
  const input = e.target as HTMLInputElement;
  void handleFile(input.files?.[0]);
  input.value = '';
}
</script>

<template>
  <AppShell>
    <main class="home">
      <div class="home__bg" aria-hidden="true" />
      <section class="hero">
        <p class="hero__brand">{{ APP_DISPLAY_NAME }}</p>
        <h1 class="hero__title">문서를 열고, 고치고, 가져가세요</h1>
        <p class="hero__lead">
          서버에 영구 저장하지 않습니다. 편집이 끝나면 다운로드하세요. 브라우저를
          닫으면 임시 파일은 삭제됩니다.
        </p>

        <label
          class="drop"
          :class="{ 'drop--active': dragging, 'drop--busy': busy }"
          @dragenter.prevent="dragging = true"
          @dragover.prevent="dragging = true"
          @dragleave.prevent="dragging = false"
          @drop.prevent="onDrop"
        >
          <input
            class="drop__input"
            type="file"
            accept=".docx,.xlsx,.pptx,.pdf,.hwp,.hwpx,.odt,.ods,.odp,.doc,.xls,.ppt,.rtf,.txt,.csv"
            :disabled="busy"
            @change="onInput"
          />
          <span class="drop__label">
            {{ busy ? '여는 중…' : '파일을 끌어다 놓거나 클릭하여 선택' }}
          </span>
          <span class="drop__hint">
            오피스·PDF → OnlyOffice · HWP/HWPX → rhwp
          </span>
        </label>

        <p v-if="error" class="hero__error" role="alert">{{ error }}</p>
      </section>
    </main>
  </AppShell>
</template>

<style scoped>
.home {
  position: relative;
  flex: 1;
  display: grid;
  place-items: center;
  padding: 3rem 1.25rem 2rem;
  overflow: hidden;
}

.home__bg {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 80% 60% at 20% 10%, #c8e0d4 0%, transparent 55%),
    radial-gradient(ellipse 70% 50% at 90% 80%, #d9cfc0 0%, transparent 50%),
    linear-gradient(165deg, #f3f6f4 0%, #e8ebe6 45%, #f7f2ea 100%);
  z-index: 0;
}

.home__bg::after {
  content: '';
  position: absolute;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%232d4a3e' fill-opacity='0.04'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
  opacity: 0.9;
}

.hero {
  position: relative;
  z-index: 1;
  width: min(560px, 100%);
  text-align: center;
  animation: rise 0.7s ease both;
}

.hero__brand {
  font-family: var(--font-display);
  font-size: clamp(2.4rem, 6vw, 3.4rem);
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--ink);
  margin: 0 0 1rem;
  line-height: 1.1;
}

.hero__title {
  font-family: var(--font-sans);
  font-size: 1.15rem;
  font-weight: 600;
  margin: 0 0 0.65rem;
  color: var(--ink-soft);
}

.hero__lead {
  margin: 0 0 1.75rem;
  color: var(--muted);
  font-size: 0.95rem;
  line-height: 1.55;
}

.drop {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.45rem;
  padding: 2.25rem 1.5rem;
  border: 1.5px dashed color-mix(in srgb, var(--accent) 45%, var(--border));
  border-radius: 4px;
  background: color-mix(in srgb, var(--surface) 70%, transparent);
  cursor: pointer;
  transition:
    border-color 0.25s ease,
    background 0.25s ease,
    transform 0.25s ease;
}

.drop:hover,
.drop--active {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent-soft) 55%, var(--surface));
  transform: translateY(-2px);
}

.drop--busy {
  opacity: 0.7;
  pointer-events: none;
}

.drop__input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  overflow: hidden;
}

.drop__label {
  font-weight: 600;
  color: var(--ink);
}

.drop__hint {
  font-size: 0.8rem;
  color: var(--muted);
}

.hero__error {
  margin: 1rem 0 0;
  color: #9b2c2c;
  font-size: 0.9rem;
}

@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
