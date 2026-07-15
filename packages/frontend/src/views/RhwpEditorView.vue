<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { createEditor, type RhwpEditor } from '@rhwp/editor';
import AppShell from '@/components/AppShell.vue';
import EditorErrorState from '@/components/EditorErrorState.vue';
import { ApiError } from '@/api/client';
import {
  clearHwpFile,
  loadHwpFile,
  useSessionLifecycle,
} from '@/composables/useSessionLifecycle';

defineOptions({ name: 'RhwpEditorView' });

const router = useRouter();
const error = ref<unknown>(null);
const filename = ref('문서.hwp');
let editor: RhwpEditor | null = null;
let initialized = false;

useSessionLifecycle({ enableHeartbeat: true });

onMounted(async () => {
  if (initialized) return;

  const stored = loadHwpFile();
  if (!stored) {
    error.value = new ApiError(
      404,
      'not_found',
      '열린 HWP 파일이 없습니다. 홈에서 다시 업로드해 주세요.',
    );
    return;
  }

  filename.value = stored.name;
  error.value = null;

  try {
    editor = await createEditor('#rhwp-host', {
      width: '100%',
      height: '100%',
    });
    await editor.loadFile(stored.buffer, stored.name);
    initialized = true;
  } catch (err) {
    error.value = err;
  }
});

onUnmounted(() => {
  editor?.destroy();
  editor = null;
  initialized = false;
});

function goHome() {
  clearHwpFile();
  void router.push({ name: 'home' });
}
</script>

<template>
  <AppShell :compact-footer="true">
    <div class="editor-page">
      <header v-if="!error" class="bar">
        <button type="button" class="bar__btn bar__btn--ghost" @click="goHome">
          ← 홈
        </button>
        <div class="bar__meta">
          <strong>{{ filename }}</strong>
          <span>
            서버에 영구 저장되지 않습니다. 닫기 전에 다운로드하세요.
            <em>파일 → 저장</em>
            (조판은 한컴과 다를 수 있습니다)
          </span>
        </div>
      </header>

      <EditorErrorState v-if="error" :error="error" context="rhwp" />
      <div v-show="!error" id="rhwp-host" class="editor-frame" />
    </div>
  </AppShell>
</template>

<style scoped>
.editor-page {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  background: var(--canvas);
}

.bar {
  flex: 0 0 auto;
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
  padding: 0.65rem 1rem;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
}

.bar__meta {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 12rem;
}

.bar__meta strong {
  font-size: 0.95rem;
}

.bar__meta span {
  font-size: 0.75rem;
  color: var(--muted);
}

.bar__meta em {
  font-style: normal;
  font-weight: 600;
  color: var(--accent);
  white-space: nowrap;
}

.bar__btn {
  border: none;
  padding: 0.5rem 0.95rem;
  border-radius: 3px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
}

.bar__btn--ghost {
  background: transparent;
  color: var(--ink);
  border: 1px solid var(--border);
}

.editor-frame {
  flex: 1 1 auto;
  min-height: 0;
  position: relative;
  width: 100%;
}

.editor-frame :deep(iframe) {
  width: 100% !important;
  height: 100% !important;
  border: none;
}
</style>
