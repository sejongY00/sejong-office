// Real "open / save" through the File System Access API (desktop Chrome, Edge, Whale).
// A file opened through the picker or dropped onto the page keeps its handle, so Save overwrites
// that same file on disk. Other browsers (Safari, Firefox, mobile) fall back to <input> + download.

import { downloadBlob } from '@/utils/downloadBlob';

type PickerType = { description?: string; accept: Record<string, string[]> };
type PermissionHandle = FileSystemFileHandle & {
  queryPermission(desc: { mode: 'readwrite' }): Promise<PermissionState>;
  requestPermission(desc: { mode: 'readwrite' }): Promise<PermissionState>;
};
type PickerWindow = Window & {
  showOpenFilePicker?(options: {
    multiple?: boolean;
    types?: PickerType[];
  }): Promise<FileSystemFileHandle[]>;
  showSaveFilePicker?(options: {
    suggestedName?: string;
    types?: PickerType[];
  }): Promise<FileSystemFileHandle>;
};
type HandleItem = DataTransferItem & {
  getAsFileSystemHandle?(): Promise<FileSystemHandle | null>;
};

const picker = window as PickerWindow;
const handles = new WeakMap<File, FileSystemFileHandle>();

/** The on-disk file this File was read from, if the browser gave us one. */
export function handleOf(file: File | null | undefined): FileSystemFileHandle | null {
  return (file && handles.get(file)) ?? null;
}

function pickerTypes(extensions: string[]): PickerType[] | undefined {
  // The MIME key is only a bucket; Chrome filters by the extensions.
  return extensions.length
    ? [{ description: '지원 파일', accept: { 'application/octet-stream': extensions } }]
    : undefined;
}

function isAbort(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}

/**
 * Open button handler. Uses the native picker when available (so the file can be saved in place),
 * otherwise clicks the given <input type=file>, whose change handler stays the fallback path.
 */
export async function pickFiles(
  input: HTMLInputElement | null,
  onFiles: (files: File[]) => void,
): Promise<void> {
  if (!picker.showOpenFilePicker || !input) {
    input?.click();
    return;
  }
  // Wildcards such as image/* can't be expressed as extensions; let the input handle those.
  const accept = input.accept.split(',').map((s) => s.trim()).filter(Boolean);
  if (accept.some((a) => a.endsWith('/*'))) {
    input.click();
    return;
  }
  try {
    const picked = await picker.showOpenFilePicker({
      multiple: input.multiple,
      types: pickerTypes(accept.filter((a) => a.startsWith('.'))),
    });
    const files = await Promise.all(
      picked.map(async (handle) => {
        const file = await handle.getFile();
        handles.set(file, handle);
        return file;
      }),
    );
    if (files.length) onFiles(files);
  } catch (err) {
    if (!isAbort(err)) throw err;
  }
}

/** Files from a drop event, with their disk handles when the browser offers them. */
export function filesFromDrop(event: DragEvent): Promise<File[]> {
  const plain = Array.from(event.dataTransfer?.files ?? []);
  // getAsFileSystemHandle must be called synchronously, before the drop event returns.
  const pending = Array.from(event.dataTransfer?.items ?? [])
    .filter((item) => item.kind === 'file')
    .map((item) => (item as HandleItem).getAsFileSystemHandle?.());
  if (!pending.length || pending.some((p) => !p)) return Promise.resolve(plain);

  return Promise.all(pending)
    .then(async (found) => {
      const files: File[] = [];
      for (const handle of found) {
        if (handle?.kind !== 'file') continue;
        const file = await (handle as FileSystemFileHandle).getFile();
        handles.set(file, handle as FileSystemFileHandle);
        files.push(file);
      }
      return files.length ? files : plain;
    })
    .catch(() => plain);
}

async function canWrite(handle: FileSystemFileHandle): Promise<boolean> {
  const h = handle as PermissionHandle;
  if (!h.queryPermission) return true;
  if ((await h.queryPermission({ mode: 'readwrite' })) === 'granted') return true;
  return (await h.requestPermission({ mode: 'readwrite' })) === 'granted';
}

/**
 * Save button handler: overwrite `handle` if given, else ask where to save, else download.
 * Call it straight from the click: the permission prompt and save dialog need that user gesture,
 * which is why the bytes come from `produce` only after the target is settled.
 * Returns the file written to (keep it for the next save), or null when cancelled or downloaded.
 */
export async function saveFile(
  options: { suggestedName: string; handle?: FileSystemFileHandle | null },
  produce: () => Blob | Promise<Blob>,
): Promise<FileSystemFileHandle | null> {
  let target: FileSystemFileHandle | null = null;
  try {
    if (options.handle && (await canWrite(options.handle))) {
      target = options.handle;
    } else if (picker.showSaveFilePicker) {
      const ext = /\.[^.]+$/.exec(options.suggestedName)?.[0];
      target = await picker.showSaveFilePicker({
        suggestedName: options.suggestedName,
        types: pickerTypes(ext ? [ext] : []),
      });
    }
  } catch (err) {
    if (isAbort(err)) return null;
    // Lost user activation (SecurityError) or similar: still give the user the file.
    target = null;
  }

  const blob = await produce();
  if (!target) {
    downloadBlob(blob, options.suggestedName);
    return null;
  }
  const writable = await target.createWritable();
  await writable.write(blob);
  await writable.close();
  return target;
}
