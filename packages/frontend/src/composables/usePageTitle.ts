import {
  onActivated,
  onMounted,
  toValue,
  watch,
  type MaybeRefOrGetter,
} from 'vue';
import { APP_DISPLAY_NAME } from '@/config/app';
import {
  faviconHrefFor,
  faviconHrefForKind,
  setFavicon,
  type FaviconKind,
} from '@/config/favicons';

export function formatPageTitle(filename?: string | null): string {
  const name = filename?.trim();
  return name ? `${name} - ${APP_DISPLAY_NAME}` : APP_DISPLAY_NAME;
}

export type UsePageTitleOptions = {
  /** Force favicon kind (tools whose file extensions collide with other tools). */
  faviconKind?: MaybeRefOrGetter<FaviconKind | null | undefined>;
};

/**
 * Sets `document.title` to `filename - Sejong Office` (or just the app name)
 * and swaps the favicon by file extension (home icon when no file).
 * Pass `faviconKind` when the route should keep a fixed tool/viewer icon.
 */
export function usePageTitle(
  filename: MaybeRefOrGetter<string | null | undefined> = null,
  options?: UsePageTitleOptions,
) {
  function apply() {
    const name = toValue(filename);
    document.title = formatPageTitle(name);
    const kind = options?.faviconKind != null ? toValue(options.faviconKind) : null;
    setFavicon(kind ? faviconHrefForKind(kind) : faviconHrefFor(name));
  }

  watch(
    () => [toValue(filename), toValue(options?.faviconKind)] as const,
    apply,
    { immediate: true },
  );
  onMounted(apply);
  onActivated(apply);
}
