import { onActivated, onDeactivated, onMounted, onUnmounted } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';

const MESSAGE = '저장하지 않은 수정이 있습니다. 저장하지 않고 계속할까요?';
const REFRESH_MS = 2000;

/**
 * Asks before unsaved edits are thrown away: leaving the page (닫기 or any link), opening another
 * file (await `confirmDiscard` first) and closing or reloading the tab (browser's own prompt).
 * `isDirty` must answer synchronously, since the tab-close prompt can't wait. For an editor that
 * can only be asked (not told), pass `refresh` to update that answer: it runs every 2 s while the
 * page is shown and right before each prompt.
 */
export function useUnsavedGuard(isDirty: () => boolean, refresh?: () => Promise<void>) {
  // Set once the user agreed, so the navigation that follows doesn't ask a second time.
  let discarded = false;
  let timer: ReturnType<typeof setInterval> | undefined;

  async function confirmDiscard(): Promise<boolean> {
    if (discarded) return true;
    await refresh?.().catch(() => undefined);
    if (!isDirty()) return true;
    if (!window.confirm(MESSAGE)) return false;
    discarded = true;
    return true;
  }

  function onBeforeUnload(event: BeforeUnloadEvent) {
    if (discarded || !isDirty()) return;
    event.preventDefault();
    // Older Chrome only shows the prompt when returnValue is set.
    event.returnValue = '';
  }

  function start() {
    window.addEventListener('beforeunload', onBeforeUnload);
    if (refresh && !timer) {
      timer = setInterval(() => void refresh().catch(() => undefined), REFRESH_MS);
    }
  }

  function stop() {
    window.removeEventListener('beforeunload', onBeforeUnload);
    if (timer) clearInterval(timer);
    timer = undefined;
  }

  onMounted(start);
  onActivated(() => {
    // Back on a kept-alive page (browser Back): its edits are on screen again, so guard them again.
    discarded = false;
    start();
  });
  onDeactivated(stop);
  onUnmounted(stop);

  onBeforeRouteLeave(() => confirmDiscard());

  return {
    confirmDiscard,
    /** Guard again after a new document was loaded into this same page. */
    rearm: () => {
      discarded = false;
    },
  };
}
