import { onActivated, onDeactivated, onMounted, onUnmounted } from 'vue';

const EXTENSION_BY_TYPE: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/bmp': 'bmp',
  'image/svg+xml': 'svg',
  'image/x-icon': 'ico',
  'image/vnd.microsoft.icon': 'ico',
};

function stamp(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-` +
    `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  );
}

/**
 * Image files on the clipboard. A screenshot arrives as a generic "image.png", so it gets a
 * dated name (used for the saved result); a copied file keeps its own name.
 */
export function imageFilesFromClipboard(data: DataTransfer | null, now = new Date()): File[] {
  if (!data) return [];
  let files = Array.from(data.files ?? []);
  if (!files.length) {
    files = Array.from(data.items ?? [])
      .filter((item) => item.kind === 'file')
      .map((item) => item.getAsFile())
      .filter((file): file is File => file !== null);
  }
  const images = files.filter((file) => file.type.startsWith('image/'));
  return images.map((file, index) => {
    if (file.name && !/^image\.\w+$/i.test(file.name)) return file;
    const suffix = images.length > 1 ? `-${index + 1}` : '';
    const extension = EXTENSION_BY_TYPE[file.type] ?? 'png';
    return new File([file], `붙여넣기-${stamp(now)}${suffix}.${extension}`, {
      type: file.type,
      lastModified: now.getTime(),
    });
  });
}

function isTextField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLInputElement && !['button', 'checkbox', 'file', 'radio', 'range', 'submit'].includes(target.type)) ||
    target.isContentEditable
  );
}

/**
 * Ctrl+V / Cmd+V of an image (screenshot, copied picture or file) while this page is shown.
 * Pasting text into a field (e.g. the image URL box) still works as usual.
 */
export function usePasteImages(onImages: (files: File[]) => void) {
  function onPaste(event: ClipboardEvent) {
    const data = event.clipboardData;
    if (isTextField(event.target) && data?.types.includes('text/plain')) return;
    const images = imageFilesFromClipboard(data);
    if (!images.length) return;
    event.preventDefault();
    onImages(images);
  }

  const start = () => window.addEventListener('paste', onPaste);
  const stop = () => window.removeEventListener('paste', onPaste);

  onMounted(start);
  onActivated(start);
  onDeactivated(stop);
  onUnmounted(stop);
}
