import { onActivated, onDeactivated, onMounted, onUnmounted } from 'vue';

/** Ctrl+S (Cmd+S on Mac). `code` also matches when a Korean or other non-Latin layout is active. */
export function isSaveShortcut(event: KeyboardEvent): boolean {
  if (!(event.ctrlKey || event.metaKey) || event.shiftKey || event.altKey) return false;
  return event.key.toLowerCase() === 's' || event.code === 'KeyS';
}

/**
 * Runs `onSave` on Ctrl+S instead of the browser's "save page" dialog, while this page is shown.
 * Listens on window in the capture phase and stops the event there, so an embedded editor that
 * has its own Ctrl+S (Excalidraw saves to a separate file) doesn't also react.
 * Keys typed inside a cross-origin iframe never reach here; those editors must forward a save.
 */
export function useSaveShortcut(onSave: () => void) {
  function onKeyDown(event: KeyboardEvent) {
    if (!isSaveShortcut(event)) return;
    event.preventDefault();
    event.stopPropagation();
    // Holding the keys down shouldn't open several save dialogs.
    if (!event.repeat) onSave();
  }

  const start = () => window.addEventListener('keydown', onKeyDown, true);
  const stop = () => window.removeEventListener('keydown', onKeyDown, true);

  onMounted(start);
  onActivated(start);
  onDeactivated(stop);
  onUnmounted(stop);
}
