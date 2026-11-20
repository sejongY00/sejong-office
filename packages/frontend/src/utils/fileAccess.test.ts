import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/downloadBlob', () => ({ downloadBlob: vi.fn() }));

import { downloadBlob } from '@/utils/downloadBlob';
import { changedOnDisk, saveFile } from './fileAccess';

/** An on-disk file as the File System Access API exposes it, kept in memory. */
class FakeHandle {
  kind = 'file' as const;
  written: Blob[] = [];
  lastModified = 1000;
  permission: PermissionState = 'granted';

  constructor(public name: string) {}

  async getFile() {
    return new File(['disk'], this.name, { lastModified: this.lastModified });
  }
  async queryPermission() {
    return this.permission;
  }
  async requestPermission() {
    return this.permission;
  }
  async createWritable() {
    return {
      write: async (blob: Blob) => {
        this.written.push(blob);
      },
      close: async () => {
        this.lastModified += 1;
      },
    };
  }
}

const asHandle = (h: FakeHandle) => h as unknown as FileSystemFileHandle;
type PickerWindow = Window & { showSaveFilePicker?: unknown };

describe('saveFile', () => {
  const blob = new Blob(['new']);
  let confirmSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(downloadBlob).mockClear();
  });

  afterEach(() => {
    delete (window as PickerWindow).showSaveFilePicker;
  });

  it('overwrites the opened file', async () => {
    const handle = new FakeHandle('a.docx');
    const written = await saveFile({ suggestedName: 'a.docx', handle: asHandle(handle) }, () => blob);
    expect(written).toBe(asHandle(handle));
    expect(handle.written).toEqual([blob]);
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('does not report its own save as an outside change', async () => {
    const handle = new FakeHandle('a.docx');
    await saveFile({ suggestedName: 'a.docx', handle: asHandle(handle) }, () => blob);
    expect(await changedOnDisk(asHandle(handle))).toBe(false);
  });

  it('overwrites unconditionally without prompting even when the file changed on disk', async () => {
    const handle = new FakeHandle('a.docx');
    await saveFile({ suggestedName: 'a.docx', handle: asHandle(handle) }, () => blob);
    handle.lastModified = 5000; // edited elsewhere
    expect(await changedOnDisk(asHandle(handle))).toBe(true);

    const produce = vi.fn(() => blob);
    const written = await saveFile({ suggestedName: 'a.docx', handle: asHandle(handle) }, produce);

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(written).toBe(asHandle(handle));
    expect(produce).toHaveBeenCalledTimes(1);
    expect(handle.written).toHaveLength(2);
  });

  it('downloads a new file directly without opening showSaveFilePicker', async () => {
    const target = new FakeHandle('새문서.docx');
    const picker = vi.fn(async () => asHandle(target));
    (window as PickerWindow).showSaveFilePicker = picker;

    const written = await saveFile({ suggestedName: '새문서.docx' }, () => blob);

    expect(picker).not.toHaveBeenCalled();
    expect(written).toBeNull();
    expect(downloadBlob).toHaveBeenCalledWith(blob, '새문서.docx');
  });

  it('downloads directly when write permission to the opened file is refused', async () => {
    const opened = new FakeHandle('a.md');
    opened.permission = 'denied';
    const picker = vi.fn(async () => asHandle(new FakeHandle('b.md')));
    (window as PickerWindow).showSaveFilePicker = picker;

    const written = await saveFile({ suggestedName: 'a.md', handle: asHandle(opened) }, () => blob);

    expect(picker).not.toHaveBeenCalled();
    expect(written).toBeNull();
    expect(opened.written).toEqual([]);
    expect(downloadBlob).toHaveBeenCalledWith(blob, 'a.md');
  });

  it('falls back to direct download when writing to the file handle throws', async () => {
    const opened = new FakeHandle('a.docx');
    opened.createWritable = async () => {
      throw new DOMException('locked', 'NoModificationAllowedError');
    };

    const written = await saveFile({ suggestedName: 'a.docx', handle: asHandle(opened) }, () => blob);

    expect(written).toBeNull();
    expect(downloadBlob).toHaveBeenCalledWith(blob, 'a.docx');
  });
});
