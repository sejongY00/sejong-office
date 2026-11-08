<script setup lang="ts">
import { ref } from 'vue';
import AppShell from '@/components/AppShell.vue';
import { consumeOfficeName, officeEditorUrl } from '@/composables/officeSession';
import { usePageTitle } from '@/composables/usePageTitle';

defineOptions({ name: 'OfficeEditorView' });

// Hand-off page: the office editor runs in its own tab (see officeSession.ts for why).
const filename = consumeOfficeName();
const title = ref(filename || '오피스 편집기');
const editorUrl = officeEditorUrl();
usePageTitle(title);
</script>

<template>
  <AppShell>
    <main class="handoff">
      <p class="handoff__eyebrow">오피스 · PDF</p>
      <h1 class="handoff__title">편집기를 새 탭에서 엽니다</h1>
      <p class="handoff__lead">
        오피스 편집기는 별도 탭에서 동작합니다. 새 탭에서
        <strong v-if="filename">{{ filename }}</strong><span v-else>파일</span>을 다시 선택하거나
        끌어다 놓아 주세요. 파일은 브라우저 안에서만 처리되고 어디에도 업로드되지 않습니다.
      </p>
      <div class="handoff__actions">
        <a class="handoff__btn handoff__btn--primary" :href="editorUrl" target="_blank" rel="noopener">
          편집기 열기 (새 탭)
        </a>
        <RouterLink class="handoff__btn" to="/">홈으로</RouterLink>
      </div>
      <p class="handoff__note">
        저장은 편집기의 파일 → 다운로드에서 합니다. 편집 중인 문서는 그 브라우저에 7일간
        자동 보관됩니다.
      </p>
    </main>
  </AppShell>
</template>

<style scoped>
.handoff {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 640px;
  margin: 0 auto;
  padding: 64px 16px;
}

.handoff__eyebrow {
  margin: 0;
  font-size: 13px;
  color: var(--muted, #888);
}

.handoff__title {
  margin: 0;
  font-size: 24px;
}

.handoff__lead,
.handoff__note {
  margin: 0;
  line-height: 1.6;
}

.handoff__note {
  font-size: 13px;
  color: var(--muted, #888);
}

.handoff__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.handoff__btn {
  display: inline-flex;
  align-items: center;
  padding: 10px 16px;
  border-radius: 8px;
  border: 1px solid var(--border, #444);
  color: inherit;
  text-decoration: none;
}

.handoff__btn--primary {
  background: var(--accent, #2563eb);
  border-color: transparent;
  color: #fff;
}
</style>
