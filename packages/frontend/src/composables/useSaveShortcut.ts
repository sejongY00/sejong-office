import { onActivated, onDeactivated, onMounted, onUnmounted } from 'vue';

type NavigatorWithUAData = Navigator & {
  userAgentData?: {
    platform?: string;
  };
};

/** True on macOS / iOS / iPadOS where Cmd (Meta) is the primary shortcut modifier. */
export function isApplePlatform(
  nav: Navigator | undefined = typeof navigator !== 'undefined' ? navigator : undefined,
): boolean {
  if (!nav) return false;
  const uaNav = nav as NavigatorWithUAData;
  const platform = uaNav.userAgentData?.platform || nav.platform || '';
  const userAgent = nav.userAgent || '';
  return /mac|iphone|ipad|ipod/i.test(platform) || /mac os x|iphone|ipad|ipod/i.test(userAgent);
}

/**
 * Matches Cmd+S on Apple platforms and Ctrl+S on Windows/Linux.
 * `code` and `'ㄴ'` also match when a Korean or other non-Latin layout is active.
 */
export function isSaveShortcut(event: KeyboardEvent, apple = isApplePlatform()): boolean {
  if (event.shiftKey || event.altKey) return false;
  const primary = apple ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
  if (!primary) return false;
  const key = event.key.toLowerCase();
  return key === 's' || key === 'ㄴ' || event.code === 'KeyS';
}

/**
 * Runs `onSave` on Ctrl+S (or Cmd+S on Mac) instead of the browser's "save page" dialog, while
 * this page is shown. Listens on window in the capture phase and stops the event there, so an
 * embedded editor that has its own Ctrl+S (Excalidraw saves to a separate file) doesn't also react.
 * Keys typed inside a cross-origin iframe never reach here; those editors forward a save message.
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
