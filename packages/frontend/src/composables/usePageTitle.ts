import {
  onActivated,
  onMounted,
  toValue,
  watch,
  type MaybeRefOrGetter,
} from 'vue';
import { APP_DISPLAY_NAME } from '@/config/app';
import { faviconHrefFor, setFavicon } from '@/config/favicons';

export function formatPageTitle(filename?: string | null): string {
  const name = filename?.trim();
  return name ? `${name} - ${APP_DISPLAY_NAME}` : APP_DISPLAY_NAME;
}

/**
 * Sets `document.title` to `filename - Sejong Office` (or just the app name)
 * and swaps the favicon by file extension (home icon when no file).
 */
export function usePageTitle(
  filename: MaybeRefOrGetter<string | null | undefined> = null,
) {
  function apply() {
    const name = toValue(filename);
    document.title = formatPageTitle(name);
    setFavicon(faviconHrefFor(name));
  }

  watch(() => toValue(filename), apply, { immediate: true });
  onMounted(apply);
  onActivated(apply);
}
