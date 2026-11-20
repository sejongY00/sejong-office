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

export type DocumentSaveStatus = 'pristine' | 'modified' | 'saved';

export function formatFilenameWithStatus(
  filename?: string | null,
  status: DocumentSaveStatus = 'pristine',
): string {
  const name = filename?.trim() ?? '';
  if (!name) return '';
  if (status === 'modified') return `${name} - 수정됨`;
  if (status === 'saved') return `${name} - 저장됨`;
  return name;
}

export function formatPageTitle(
  filename?: string | null,
  status: DocumentSaveStatus = 'pristine',
): string {
  const display = formatFilenameWithStatus(filename, status);
  return display ? `${display} - ${APP_DISPLAY_NAME}` : APP_DISPLAY_NAME;
}

export type UsePageTitleOptions = {
  /** Force favicon kind (tools whose file extensions collide with other tools). */
  faviconKind?: MaybeRefOrGetter<FaviconKind | null | undefined>;
  /** Current save status shown next to the filename (`- 수정됨` / `- 저장됨`). */
  status?: MaybeRefOrGetter<DocumentSaveStatus | null | undefined>;
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
    const status = options?.status != null ? (toValue(options.status) ?? 'pristine') : 'pristine';
    document.title = formatPageTitle(name, status);
    const kind = options?.faviconKind != null ? toValue(options.faviconKind) : null;
    setFavicon(kind ? faviconHrefForKind(kind) : faviconHrefFor(name));
  }

  watch(
    () => [toValue(filename), toValue(options?.faviconKind), toValue(options?.status)] as const,
    apply,
    { immediate: true },
  );
  onMounted(apply);
  onActivated(apply);
}
