import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/downloadBlob', () => ({ downloadBlob: vi.fn() }));

import { downloadBlob } from '@/utils/downloadBlob';
import { acceptDiskVersion, bindFileHandle, changedOnDisk, saveFile } from './fileAccess';

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

  it('asks before overwriting a file another app changed, and keeps it on "no"', async () => {
    const handle = new FakeHandle('a.docx');
    await saveFile({ suggestedName: 'a.docx', handle: asHandle(handle) }, () => blob);
    handle.lastModified = 5000; // edited elsewhere
    expect(await changedOnDisk(asHandle(handle))).toBe(true);

    confirmSpy.mockReturnValue(false);
    const produce = vi.fn(() => blob);
    const onSaved = vi.fn();
    const written = await saveFile({ suggestedName: 'a.docx', handle: asHandle(handle), onSaved }, produce);

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(written).toBeNull();
    expect(produce).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
    expect(handle.written).toHaveLength(1);
  });

  it('asks where to save a new file when the browser can', async () => {
    const target = new FakeHandle('새문서.docx');
    const picker = vi.fn(async () => asHandle(target));
    const onSaved = vi.fn();
    (window as PickerWindow).showSaveFilePicker = picker;

    const written = await saveFile({ suggestedName: '새문서.docx', onSaved }, () => blob);

    expect(picker).toHaveBeenCalledWith(expect.objectContaining({ suggestedName: '새문서.docx' }));
    expect(written).toBe(asHandle(target));
    expect(onSaved).toHaveBeenCalledWith(asHandle(target));
    expect(target.written).toEqual([blob]);
  });

  it('does nothing when the save dialog is cancelled', async () => {
    (window as PickerWindow).showSaveFilePicker = vi.fn(async () => {
      throw new DOMException('cancelled', 'AbortError');
    });
    const produce = vi.fn(() => blob);
    const onSaved = vi.fn();
    expect(await saveFile({ suggestedName: 'a.md', onSaved }, produce)).toBeNull();
    expect(produce).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
    expect(downloadBlob).not.toHaveBeenCalled();
  });

  it('downloads instead on browsers without a save dialog', async () => {
    const onSaved = vi.fn();
    expect(await saveFile({ suggestedName: 'a.md', onSaved }, () => blob)).toBeNull();
    expect(downloadBlob).toHaveBeenCalledWith(blob, 'a.md');
    expect(onSaved).toHaveBeenCalledWith(null);
  });

  it('asks for a new place when write permission to the opened file is refused', async () => {
    const opened = new FakeHandle('a.md');
    opened.permission = 'denied';
    const other = new FakeHandle('b.md');
    (window as PickerWindow).showSaveFilePicker = vi.fn(async () => asHandle(other));

    const written = await saveFile({ suggestedName: 'a.md', handle: asHandle(opened) }, () => blob);

    expect(written).toBe(asHandle(other));
    expect(opened.written).toEqual([]);
  });

  it('aborts before createWritable() when produced blob is empty or invalid', async () => {
    const handle = new FakeHandle('report.docx');
    const createWritableSpy = vi.spyOn(handle, 'createWritable');
    const onSaved = vi.fn();

    await expect(
      saveFile({ suggestedName: 'report.docx', handle: asHandle(handle), onSaved }, () => new Blob([])),
    ).rejects.toThrow(/비어/);

    await expect(
      saveFile({ suggestedName: 'notes.txt', handle: asHandle(handle), onSaved }, () => new Blob([])),
    ).rejects.toThrow(/비어/);

    await expect(
      saveFile({ suggestedName: 'export.pdf', onSaved }, () => new Blob([])),
    ).rejects.toThrow(/비어/);

    await expect(
      saveFile({ suggestedName: 'report.docx', handle: asHandle(handle), onSaved }, () => {
        throw new Error('손상된 DOCX');
      }),
    ).rejects.toThrow('손상된 DOCX');

    expect(createWritableSpy).not.toHaveBeenCalled();
    expect(handle.written).toEqual([]);
    expect(downloadBlob).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('prefers getLastModified() over getFile() in changedOnDisk and acceptDiskVersion', async () => {
    let diskMtime = 1000;
    const getFile = vi.fn(async () => new File(['disk'], 'a.docx', { lastModified: diskMtime }));
    const getLastModified = vi.fn(async () => diskMtime);
    const handle = {
      kind: 'file' as const,
      name: 'a.docx',
      getFile,
      getLastModified,
    } as unknown as FileSystemFileHandle;

    bindFileHandle(new File(['disk'], 'a.docx', { lastModified: 1000 }), handle);
    expect(await changedOnDisk(handle)).toBe(false);
    expect(getLastModified).toHaveBeenCalledTimes(1);
    expect(getFile).not.toHaveBeenCalled();

    diskMtime = 2000;
    expect(await changedOnDisk(handle)).toBe(true);
    await acceptDiskVersion(handle);
    expect(await changedOnDisk(handle)).toBe(false);
    expect(getFile).not.toHaveBeenCalled();
  });
});
