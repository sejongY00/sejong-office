import { computed, ref } from 'vue';

const updateState = ref<SejongDesktopUpdateState | null>(null);
const dismissed = ref(false);
let subscribed = false;
let autoHideTimer: ReturnType<typeof setTimeout> | undefined;

function clearAutoHide() {
  if (autoHideTimer) {
    clearTimeout(autoHideTimer);
    autoHideTimer = undefined;
  }
}

function applyIncomingState(next: SejongDesktopUpdateState) {
  const prevStatus = updateState.value?.status;
  updateState.value = next;
  clearAutoHide();

  // Re-open banner on meaningful state transitions or manual checks
  if (!next.silent || next.status === 'available' || next.status === 'downloading' || next.status === 'downloaded') {
    if (prevStatus !== next.status || !next.silent) {
      dismissed.value = false;
    }
  }

  if (next.status === 'not-available' && !next.silent) {
    autoHideTimer = setTimeout(() => {
      dismissed.value = true;
    }, 4500);
  }
}

function ensureSubscribed() {
  if (subscribed || typeof window === 'undefined' || !window.sejongDesktop) return;
  subscribed = true;

  window.sejongDesktop.onUpdateStateChange?.((next) => {
    applyIncomingState(next);
  });

  void window.sejongDesktop.getUpdateState?.().then((initial) => {
    if (initial) applyIncomingState(initial);
  });
}

export function useDesktopUpdate() {
  ensureSubscribed();

  const isVisible = computed(() => {
    const s = updateState.value;
    if (!s || dismissed.value) return false;
    if (s.status === 'idle') return false;
    if (s.silent && (s.status === 'checking' || s.status === 'not-available' || s.status === 'error')) {
      return false;
    }
    return true;
  });

  const isChecking = computed(() => updateState.value?.status === 'checking');

  async function checkForUpdates() {
    dismissed.value = false;
    const next = await window.sejongDesktop?.checkForUpdates?.();
    if (next) applyIncomingState(next);
  }

  async function downloadUpdate() {
    dismissed.value = false;
    const next = await window.sejongDesktop?.downloadUpdate?.();
    if (next) applyIncomingState(next);
  }

  async function installUpdate() {
    await window.sejongDesktop?.installUpdate?.();
  }

  function dismiss() {
    clearAutoHide();
    dismissed.value = true;
  }

  return {
    updateState,
    isVisible,
    isChecking,
    checkForUpdates,
    downloadUpdate,
    installUpdate,
    dismiss,
  };
}
