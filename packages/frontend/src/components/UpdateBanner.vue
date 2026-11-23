<script setup lang="ts">
import { useDesktopUpdate } from '@/composables/useDesktopUpdate';
import { applyUpdate, updateReady } from '@/pwa/serviceWorkerUpdates';

const isDesktop = Boolean(window.sejongDesktop);
const {
  updateState,
  isVisible: desktopVisible,
  downloadUpdate,
  installUpdate,
  dismiss: dismissDesktop,
} = useDesktopUpdate();

// Hidden for this visit only; the update still applies once every tab is closed.
function dismissWeb() {
  updateReady.value = false;
}
</script>

<template>
  <div
    v-if="!isDesktop && updateReady"
    class="update"
    role="status"
    aria-live="polite"
  >
    <span class="update__text">새 버전이 있습니다. 저장한 뒤 새로고침하세요.</span>
    <button type="button" class="update__primary" @click="applyUpdate">새로고침</button>
    <button type="button" class="update__later" @click="dismissWeb">나중에</button>
  </div>

  <div
    v-else-if="isDesktop && desktopVisible && updateState"
    class="update"
    role="status"
    aria-live="polite"
  >
    <template v-if="updateState.status === 'checking'">
      <span class="update__text">업데이트를 확인하고 있습니다…</span>
    </template>

    <template v-else-if="updateState.status === 'available'">
      <span class="update__text">
        새 버전 <strong>v{{ updateState.latestVersion }}</strong>이 있습니다.
      </span>
      <button type="button" class="update__primary" @click="downloadUpdate">
        {{ updateState.mode === 'auto' ? '업데이트' : '설치 파일 받기' }}
      </button>
      <button type="button" class="update__later" @click="dismissDesktop">나중에</button>
    </template>

    <template v-else-if="updateState.status === 'downloading'">
      <div class="update__progress-wrap">
        <span class="update__text">
          업데이트 다운로드 중… {{ updateState.percent ?? 0 }}%
        </span>
        <progress class="update__bar" :value="updateState.percent ?? 0" max="100" />
      </div>
    </template>

    <template v-else-if="updateState.status === 'downloaded'">
      <span class="update__text">
        {{
          updateState.mode === 'auto'
            ? `v${updateState.latestVersion ?? ''} 업데이트가 준비되었습니다. 저장한 뒤 재시작하세요.`
            : `v${updateState.latestVersion ?? ''} 설치 파일을 다운로드했습니다.`
        }}
      </span>
      <button type="button" class="update__primary" @click="installUpdate">
        {{ updateState.mode === 'auto' ? '재시작하여 설치' : '설치 파일 열기' }}
      </button>
      <button type="button" class="update__later" @click="dismissDesktop">나중에</button>
    </template>

    <template v-else-if="updateState.status === 'not-available'">
      <span class="update__text">
        현재 최신 버전(v{{ updateState.currentVersion }})을 사용 중입니다.
      </span>
      <button type="button" class="update__later" @click="dismissDesktop">확인</button>
    </template>

    <template v-else-if="updateState.status === 'error'">
      <span class="update__text">
        {{ updateState.message || '업데이트를 확인할 수 없습니다.' }}
      </span>
      <button type="button" class="update__later" @click="dismissDesktop">닫기</button>
    </template>
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

.update__progress-wrap {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-width: 220px;
}

.update__bar {
  width: 100%;
  height: 6px;
  accent-color: var(--accent);
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
