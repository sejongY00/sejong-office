<script setup lang="ts">
import { computed, onActivated, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import AppShell from '@/components/AppShell.vue';
import EditorToolbar from '@/components/EditorToolbar.vue';
import { useFileDropZone } from '@/composables/useFileDropZone';
import { consumeViewerFiles } from '@/composables/viewerSession';
import { usePageTitle } from '@/composables/usePageTitle';
import {
  isMarkdownFile,
  renderMarkdown,
} from '@/integrations/markdown/render';
import { downloadText, readTextFile } from '@/utils/downloadBlob';

defineOptions({ name: 'MarkdownViewerView' });

const DEFAULT_SOURCE = `# 마크다운

왼쪽 칸에 입력하거나 \`.md\` 파일을 열면 미리보기가 표시됩니다.

- **굵게** · *기울임* · \`코드\`
- [링크](https://git.sejong.dev)

\`\`\`ts
console.log('hello');
\`\`\`
`;

const router = useRouter();
const fileInput = ref<HTMLInputElement | null>(null);
const filename = ref('미리보기.md');
const source = ref(DEFAULT_SOURCE);
const error = ref('');
const busy = ref(false);

usePageTitle(filename, { faviconKind: 'markdown' });

const html = computed(() => renderMarkdown(source.value));

function onClose() {
  void router.push({ name: 'home' });
}

function onOpen() {
  fileInput.value?.click();
}

function onSave() {
  downloadText(source.value, filename.value, 'text/markdown;charset=utf-8');
}

async function loadFile(file: File) {
  if (!isMarkdownFile(file)) {
    error.value = '.md 또는 .markdown 파일을 선택해 주세요.';
    return;
  }
  busy.value = true;
  error.value = '';
  try {
    source.value = await readTextFile(file);
    filename.value = file.name.replace(/\.markdown$/i, '.md');
  } catch (reason) {
    error.value =
      reason instanceof Error ? reason.message : '파일을 열지 못했습니다.';
  } finally {
    busy.value = false;
  }
}

function onFileSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (file) void loadFile(file);
}

function consumePending() {
  const [file] = consumeViewerFiles('markdown');
  if (file) void loadFile(file);
}

onMounted(consumePending);
onActivated(consumePending);

const {
  dropActive,
  onDragEnter,
  onDragOver,
  onDragLeave,
  onDrop: onZoneDrop,
} = useFileDropZone((files) => {
  const file = files[0];
  if (file) void loadFile(file);
});

watch(source, () => {
  if (error.value && source.value) error.value = '';
});
</script>

<template>
  <AppShell :editor="true">
    <div
      class="md-page"
      :class="{ 'is-drop-active': dropActive }"
      @dragenter="onDragEnter"
      @dragover="onDragOver"
      @dragleave="onDragLeave"
      @drop="onZoneDrop"
    >
      <EditorToolbar
        :filename="filename"
        :busy="busy"
        save-label="다운로드"
        @open="onOpen"
        @save="onSave"
        @close="onClose"
      />
      <input
        ref="fileInput"
        class="sr-only"
        type="file"
        accept=".md,.markdown,.mdown,text/markdown,text/plain"
        @change="onFileSelected"
      />
      <p v-if="error" class="viewer-message viewer-message--error" role="alert">
        {{ error }}
      </p>

      <div class="md-layout">
        <section class="source-pane" aria-label="마크다운 입력">
          <textarea
            v-model="source"
            class="source"
            spellcheck="false"
            :disabled="busy"
            aria-label="마크다운 원문"
            placeholder="# 제목&#10;&#10;여기에 마크다운을 입력하세요."
          />
        </section>
        <section class="preview-pane" aria-label="마크다운 미리보기">
          <article class="preview" v-html="html" />
        </section>
      </div>

      <div v-if="dropActive" class="drop-overlay" aria-hidden="true">
        마크다운 파일을 놓아 열기
      </div>
    </div>
  </AppShell>
</template>

<style scoped>
.md-page {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  background: var(--canvas);
}

.md-layout {
  flex: 1 1 auto;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(16rem, 1fr) minmax(0, 1.15fr);
  gap: 1px;
  background: var(--border);
}

.source-pane,
.preview-pane {
  min-width: 0;
  min-height: 0;
  background: var(--surface);
}

.source {
  display: block;
  width: 100%;
  height: 100%;
  resize: none;
  border: 0;
  outline: 0;
  padding: 1rem;
  background: var(--surface);
  color: var(--ink);
  font: 0.9rem/1.55 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  tab-size: 2;
}

.preview-pane {
  overflow: auto;
  padding: 1.25rem 1.4rem 2rem;
}

.preview {
  max-width: 46rem;
  color: var(--ink);
  font-size: 0.95rem;
  line-height: 1.65;
  word-break: break-word;
}

.preview :deep(:first-child) {
  margin-top: 0;
}

.preview :deep(h1),
.preview :deep(h2),
.preview :deep(h3),
.preview :deep(h4) {
  margin: 1.35em 0 0.5em;
  line-height: 1.3;
  font-weight: 650;
}

.preview :deep(h1) {
  font-size: 1.7rem;
  padding-bottom: 0.3em;
  border-bottom: 1px solid var(--border);
}

.preview :deep(h2) {
  font-size: 1.3rem;
  padding-bottom: 0.25em;
  border-bottom: 1px solid var(--border);
}

.preview :deep(h3) {
  font-size: 1.1rem;
}

.preview :deep(p),
.preview :deep(ul),
.preview :deep(ol),
.preview :deep(blockquote),
.preview :deep(pre),
.preview :deep(table) {
  margin: 0 0 1em;
}

.preview :deep(ul),
.preview :deep(ol) {
  padding-left: 1.4em;
}

.preview :deep(a) {
  color: var(--accent);
}

.preview :deep(code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.86em;
  padding: 0.12em 0.35em;
  border-radius: 4px;
  background: var(--canvas);
}

.preview :deep(pre) {
  overflow: auto;
  padding: 0.85rem 1rem;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--canvas);
}

.preview :deep(pre code) {
  padding: 0;
  background: none;
}

.preview :deep(blockquote) {
  padding: 0 0.85rem;
  border-left: 3px solid var(--accent);
  color: var(--muted);
}

.preview :deep(hr) {
  border: 0;
  border-top: 1px solid var(--border);
  margin: 1.4em 0;
}

.preview :deep(img) {
  max-width: 100%;
  height: auto;
}

.preview :deep(table) {
  display: block;
  width: max-content;
  max-width: 100%;
  overflow: auto;
  border-collapse: collapse;
}

.preview :deep(th),
.preview :deep(td) {
  padding: 0.4rem 0.65rem;
  border: 1px solid var(--border);
}

.preview :deep(th) {
  background: var(--canvas);
  text-align: left;
}

.drop-overlay {
  position: absolute;
  inset: 2.75rem 0.5rem 0.5rem;
  z-index: 20;
  display: grid;
  place-items: center;
  border: 2px dashed var(--accent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--accent-soft) 88%, transparent);
  color: var(--ink);
  font-weight: 650;
  pointer-events: none;
}

.viewer-message {
  margin: 0;
  padding: 0.45rem 0.85rem;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
  color: var(--ink);
  font-size: 0.86rem;
}

.viewer-message--error {
  color: #b42318;
  background: color-mix(in srgb, #b42318 10%, var(--surface));
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (max-width: 760px) {
  .md-layout {
    grid-template-columns: 1fr;
    grid-template-rows: minmax(12rem, 0.85fr) minmax(14rem, 1fr);
  }
}
</style>
