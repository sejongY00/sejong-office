import { onActivated, onDeactivated, onMounted, onUnmounted, ref } from 'vue';
import { acceptDiskVersion, changedOnDisk, readFromDisk } from '@/utils/fileAccess';

const POLL_MS = 3000;

/**
 * Notices when the opened file is changed by another app. Only flags it (the view shows a banner);
 * reloading is the user's choice, since it would drop edits not yet saved here.
 * Checks while the tab is visible and the view active, and right away when the user comes back.
 */
export function useFileChangeWatch(
  getHandle: () => FileSystemFileHandle | null,
  reload: (file: File) => void | Promise<void>,
) {
  const changed = ref(false);
  let timer: ReturnType<typeof setInterval> | undefined;

  async function check() {
    const handle = getHandle();
    if (!handle || document.visibilityState !== 'visible') return;
    // Re-evaluated every time, so the banner also clears once a save here overwrites the change.
    changed.value = await changedOnDisk(handle);
  }

  function onVisible() {
    if (document.visibilityState === 'visible') void check();
  }

  function start() {
    if (timer) return;
    timer = setInterval(() => void check(), POLL_MS);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    void check();
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = undefined;
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('focus', onVisible);
  }

  onMounted(start);
  onActivated(start);
  onDeactivated(stop);
  onUnmounted(stop);

  async function reloadFromDisk() {
    const handle = getHandle();
    changed.value = false;
    if (handle) await reload(await readFromDisk(handle));
  }

  async function keepMine() {
    const handle = getHandle();
    changed.value = false;
    if (handle) await acceptDiskVersion(handle);
  }

  return { changed, reloadFromDisk, keepMine };
}
