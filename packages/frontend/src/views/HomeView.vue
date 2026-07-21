<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import AppShell from '@/components/AppShell.vue';
import FileTypeIcon from '@/components/FileTypeIcon.vue';
import { APP_DISPLAY_NAME } from '@/config/app';
import { useOpenDocument } from '@/composables/useOpenDocument';
import { usePageTitle } from '@/composables/usePageTitle';
import type { BlankDocumentType } from '@/api/client';

const dragging = ref(false);
const router = useRouter();
const { busy, error, openDocument, createAndOpenBlank } = useOpenDocument();

usePageTitle();

const blankTypes: {
  type: BlankDocumentType;
  title: string;
  subtitle: string;
}[] = [
  { type: 'docx', title: '문서 (DOCX)', subtitle: '새문서.docx' },
  { type: 'xlsx', title: '스프레드시트 (XLSX)', subtitle: '새문서.xlsx' },
  { type: 'pptx', title: '프레젠테이션 (PPTX)', subtitle: '새문서.pptx' },
  { type: 'pdf', title: 'PDF', subtitle: '새문서.pdf' },
  { type: 'hwpx', title: '한글 문서 (HWPX)', subtitle: '새문서.hwpx' },
];

const diagramTypes = [
  {
    route: 'excalidraw-editor',
    extension: 'excalidraw',
    title: '스케치 (Excalidraw)',
    subtitle: '새그림.excalidraw',
  },
  {
    route: 'mermaid-editor',
    extension: 'mmd',
    title: '텍스트 다이어그램 (Mermaid)',
    subtitle: '새다이어그램.mmd',
  },
  {
    route: 'drawio-editor',
    extension: 'drawio',
    title: '다이어그램 (draw.io)',
    subtitle: '새다이어그램.drawio',
  },
] as const;

function onDrop(e: DragEvent) {
  dragging.value = false;
  void openDocument(e.dataTransfer?.files?.[0]);
}

function onInput(e: Event) {
  const input = e.target as HTMLInputElement;
  void openDocument(input.files?.[0]);
  input.value = '';
}

function onCreate(type: BlankDocumentType) {
  void createAndOpenBlank(type);
}

function onCreateDiagram(route: string) {
  void router.push({ name: route });
}
</script>

<template>
  <AppShell>
    <main class="home">
      <header class="home__top">
        <h1 class="home__brand">{{ APP_DISPLAY_NAME }}</h1>
        <RouterLink class="home__licenses" to="/licenses">라이선스</RouterLink>
      </header>

      <section class="section">
        <h2 class="section__title">파일 열기</h2>
        <p class="section__lead">
          서버에 영구 저장하지 않습니다. 편집 후 저장(다운로드)하세요.
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
            accept=".docx,.xlsx,.pptx,.pdf,.hwp,.hwpx,.odt,.ods,.odp,.doc,.xls,.ppt,.rtf,.txt,.csv,.excalidraw,.mmd,.mermaid,.drawio,.xml"
            :disabled="busy"
            @change="onInput"
          />
          <span class="drop__label">
            {{ busy ? '여는 중…' : '파일을 끌어다 놓거나 클릭하여 선택' }}
          </span>
          <span class="drop__hint">
            오피스·PDF · HWP/HWPX · 다이어그램
          </span>
        </label>

        <p v-if="error" class="home__error" role="alert">{{ error }}</p>
      </section>

      <section class="section">
        <h2 class="section__title">새 문서</h2>
        <p class="section__lead">빈 문서를 만들어 바로 편집합니다.</p>

        <div class="grid">
          <button
            v-for="item in blankTypes"
            :key="item.type"
            type="button"
            class="tile"
            :disabled="busy"
            @click="onCreate(item.type)"
          >
            <FileTypeIcon :extension="item.type" :size="36" />
            <span class="tile__text">
              <strong>{{ item.title }}</strong>
              <span>{{ item.subtitle }}</span>
            </span>
          </button>
        </div>
      </section>

      <section class="section">
        <h2 class="section__title">다이어그램</h2>
        <p class="section__lead">
          브라우저에서 직접 편집하고 원본·SVG·PNG로 저장합니다.
        </p>

        <div class="grid">
          <button
            v-for="item in diagramTypes"
            :key="item.route"
            type="button"
            class="tile"
            :disabled="busy"
            @click="onCreateDiagram(item.route)"
          >
            <FileTypeIcon :extension="item.extension" :size="36" />
            <span class="tile__text">
              <strong>{{ item.title }}</strong>
              <span>{{ item.subtitle }}</span>
            </span>
          </button>
        </div>
      </section>
    </main>
  </AppShell>
</template>

<style scoped>
.home {
  flex: 1;
  width: min(920px, 100%);
  margin: 0 auto;
  padding: 1.5rem 1.25rem 3rem;
}

.home__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.75rem;
}

.home__brand {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.5rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--ink);
}

.home__licenses {
  font-size: 0.85rem;
  color: var(--muted);
  text-decoration: none;
}

.home__licenses:hover {
  color: var(--accent);
}

.section {
  margin-bottom: 2rem;
}

.section__title {
  margin: 0 0 0.35rem;
  font-size: 1.15rem;
  font-weight: 600;
  color: var(--ink);
}

.section__lead {
  margin: 0 0 1rem;
  font-size: 0.9rem;
  color: var(--muted);
}

.drop {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  min-height: 7.5rem;
  padding: 1.5rem 1.25rem;
  border: 1.5px dashed var(--border);
  border-radius: 8px;
  background: var(--card);
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    background 0.2s ease;
}

.drop:hover,
.drop--active {
  border-color: var(--accent);
  background: var(--accent-soft);
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
  font-size: 0.95rem;
  color: var(--ink);
}

.drop__hint {
  font-size: 0.8rem;
  color: var(--muted);
}

.home__error {
  margin: 0.85rem 0 0;
  color: var(--danger);
  font-size: 0.9rem;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 0.75rem;
}

.tile {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  padding: 0.9rem 1rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--card);
  text-align: left;
  cursor: pointer;
  font-family: inherit;
  color: var(--ink);
  transition:
    background 0.15s ease,
    border-color 0.15s ease;
}

.tile:hover:not(:disabled) {
  background: var(--card-hover);
  border-color: color-mix(in srgb, var(--accent) 40%, var(--border));
}

.tile:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.tile__text {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
}

.tile__text strong {
  font-size: 0.92rem;
  font-weight: 600;
}

.tile__text span {
  font-size: 0.78rem;
  color: var(--muted);
}
</style>
