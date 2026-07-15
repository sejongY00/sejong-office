<script setup lang="ts">
import { computed } from 'vue';
import { ApiError } from '@/api/client';

const props = defineProps<{
  error: unknown;
  context?: 'onlyoffice' | 'rhwp';
}>();

const code = computed(() => {
  if (props.error instanceof ApiError) return props.error.code;
  return 'unknown';
});

const title = computed(() => {
  switch (code.value) {
    case 'not_found':
      return '문서를 찾을 수 없습니다';
    case 'session_required':
      return '세션이 만료되었습니다';
    case 'unsupported_type':
      return '지원하지 않는 파일 형식입니다';
    default:
      return '문서를 열 수 없습니다';
  }
});

const detail = computed(() => {
  switch (code.value) {
    case 'not_found':
      return '임시 세션이 끝났거나, 다른 탭에서 세션이 바뀌었을 수 있습니다. 서버에는 파일을 영구 보관하지 않으므로 홈에서 다시 열어 주세요. 편집 중이라면 가능하면 에디터의 파일 → 저장으로 먼저 받아 두세요.';
    case 'session_required':
      return '브라우저를 오래 두었거나 세션이 초기화되었습니다. 홈으로 돌아가 파일을 다시 선택해 주세요.';
    default:
      if (props.error instanceof Error && props.error.message) {
        return props.error.message;
      }
      return '알 수 없는 오류가 발생했습니다. 홈에서 다시 시도해 주세요.';
  }
});
</script>

<template>
  <div class="err" role="alert">
    <p class="err__eyebrow">{{ context === 'rhwp' ? 'HWP 에디터' : '문서 에디터' }}</p>
    <h1 class="err__title">{{ title }}</h1>
    <p class="err__detail">{{ detail }}</p>
    <p v-if="code !== 'unknown'" class="err__code">오류 코드: {{ code }}</p>
    <div class="err__actions">
      <RouterLink class="err__btn err__btn--primary" to="/">홈으로 돌아가기</RouterLink>
      <RouterLink class="err__btn" to="/licenses">라이선스 보기</RouterLink>
    </div>
  </div>
</template>

<style scoped>
.err {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
  gap: 0.65rem;
  max-width: 36rem;
  margin: 0 auto;
  padding: 2.5rem 1.5rem;
}

.err__eyebrow {
  margin: 0;
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--accent);
}

.err__title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.75rem;
  font-weight: 600;
  color: var(--ink);
}

.err__detail {
  margin: 0;
  line-height: 1.6;
  color: var(--muted);
  font-size: 0.95rem;
}

.err__code {
  margin: 0;
  font-size: 0.8rem;
  color: var(--muted);
  opacity: 0.8;
}

.err__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 0.75rem;
}

.err__btn {
  display: inline-flex;
  align-items: center;
  padding: 0.55rem 1rem;
  border-radius: 3px;
  text-decoration: none;
  font-weight: 600;
  font-size: 0.9rem;
  border: 1px solid var(--border);
  color: var(--ink);
  background: var(--surface);
}

.err__btn--primary {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}
</style>
