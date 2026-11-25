import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { isHwp, isOffice } from '@/config/app';
import { acceptDiskVersion, changedOnDisk, handleOf, saveFile } from '@/utils/fileAccess';
import {
  createDesktopFileHandle,
  desktopLaunchQueue,
  registerFileLaunch,
  type DesktopBridge,
  type FileLaunchParams,
  type FileLaunchQueue,
} from './fileLaunch';

function fakeFileHandle(name: string, content = 'body'): FileSystemFileHandle {
  return {
    kind: 'file',
    name,
    getFile: vi.fn(async () => new File([content], name, { lastModified: 1234 })),
  } as unknown as FileSystemFileHandle;
}

function fakeLaunchQueue() {
  let consumer: ((params: FileLaunchParams) => void) | null = null;
  const queue: FileLaunchQueue = {
    setConsumer(fn) {
      consumer = fn;
    },
  };
  return {
    queue,
    dispatch(files: readonly FileSystemHandle[]) {
      consumer?.({ files });
    },
  };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('registerFileLaunch', () => {
  it('does nothing when the browser has no launchQueue', () => {
    expect(registerFileLaunch(undefined, vi.fn())).toBe(false);
  });

  it('opens launched files and keeps their disk handles for in-place Save', async () => {
    const { queue, dispatch } = fakeLaunchQueue();
    const opened: File[][] = [];
    const handle = fakeFileHandle('slides.pptx', 'pptx-bytes');

    expect(
      registerFileLaunch(queue, (files) => {
        opened.push(files);
      }),
    ).toBe(true);

    dispatch([handle]);
    await flush();

    expect(opened).toHaveLength(1);
    expect(opened[0]).toHaveLength(1);
    expect(opened[0][0].name).toBe('slides.pptx');
    expect(handleOf(opened[0][0])).toBe(handle);
  });

  it('ignores launches with no file handles', async () => {
    const { queue, dispatch } = fakeLaunchQueue();
    const openFiles = vi.fn();
    registerFileLaunch(queue, openFiles);

    dispatch([]);
    dispatch([{ kind: 'directory', name: 'folder' } as FileSystemHandle]);
    await flush();

    expect(openFiles).not.toHaveBeenCalled();
  });

  it('ignores user-cancelled or denied handle reads without calling onError', async () => {
    const { queue, dispatch } = fakeLaunchQueue();
    const openFiles = vi.fn();
    const onError = vi.fn();
    const denied = {
      kind: 'file',
      name: 'secret.docx',
      getFile: vi.fn(async () => {
        throw new DOMException('denied', 'NotAllowedError');
      }),
    } as unknown as FileSystemFileHandle;

    registerFileLaunch(queue, openFiles, onError);
    dispatch([denied]);
    await flush();

    expect(openFiles).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it('reports unexpected read errors to onError', async () => {
    const { queue, dispatch } = fakeLaunchQueue();
    const boom = new Error('disk read failed');
    const onError = vi.fn();
    const broken = {
      kind: 'file',
      name: 'broken.hwp',
      getFile: vi.fn(async () => {
        throw boom;
      }),
    } as unknown as FileSystemFileHandle;

    registerFileLaunch(queue, vi.fn(), onError);
    dispatch([broken]);
    await flush();

    expect(onError).toHaveBeenCalledWith(boom);
  });

  it('opens desktop bridge files and overwrites them in place on saveFile', async () => {
    const disk = new Map<string, { bytes: Uint8Array; lastModified: number }>();
    disk.set('/Users/sejong/Documents/report.hwpx', {
      bytes: new TextEncoder().encode('original-hwpx'),
      lastModified: 1000,
    });

    let openListener: ((paths: string[]) => void) | null = null;
    const bridge: DesktopBridge = {
      consumeLaunchFiles: vi.fn(async () => ['/Users/sejong/Documents/report.hwpx']),
      onOpenFiles: vi.fn((cb) => {
        openListener = cb;
        return () => {
          openListener = null;
        };
      }),
      readFile: vi.fn(async (filePath) => {
        const entry = disk.get(filePath);
        if (!entry) throw new Error('missing file');
        return {
          path: filePath,
          name: 'report.hwpx',
          bytes: entry.bytes,
          lastModified: entry.lastModified,
        };
      }),
      writeFile: vi.fn(async (filePath, bytes) => {
        const nextMod = 2000;
        disk.set(filePath, { bytes, lastModified: nextMod });
        return { lastModified: nextMod };
      }),
    };

    const opened: File[] = [];
    registerFileLaunch(desktopLaunchQueue(bridge), (files) => {
      opened.push(...files);
    });

    await flush();
    await flush();

    expect(opened).toHaveLength(1);
    expect(opened[0].name).toBe('report.hwpx');
    const handle = handleOf(opened[0]);
    expect(handle).not.toBeNull();

    await saveFile(
      { suggestedName: 'report.hwpx', handle },
      () => new Blob(['updated-hwpx']),
    );

    const saved = disk.get('/Users/sejong/Documents/report.hwpx');
    expect(new TextDecoder().decode(saved?.bytes)).toBe('updated-hwpx');
    expect(saved?.lastModified).toBe(2000);
    expect(openListener).toBeTypeOf('function');
  });

  it('notifies onInitialEmpty when no startup files exist and onIncoming when files arrive later', async () => {
    const openListeners: Array<(paths: string[]) => void> = [];
    const onIncoming = vi.fn();
    const onInitialEmpty = vi.fn();
    const bridge: DesktopBridge = {
      consumeLaunchFiles: vi.fn(async () => []),
      onOpenFiles: vi.fn((cb) => {
        openListeners.push(cb);
        return () => {};
      }),
      readFile: vi.fn(async (p) => ({
        path: p,
        name: 'late.docx',
        bytes: new Uint8Array([1, 2, 3]),
        lastModified: 100,
      })),
      writeFile: vi.fn(async () => ({ lastModified: 200 })),
    };

    const opened: File[][] = [];
    registerFileLaunch(
      desktopLaunchQueue(bridge, { onIncoming, onInitialEmpty }),
      (files) => {
        opened.push(files);
      },
    );
    await flush();

    expect(onInitialEmpty).toHaveBeenCalledTimes(1);
    expect(onIncoming).not.toHaveBeenCalled();

    for (const cb of openListeners) cb(['/tmp/late.docx']);
    expect(onIncoming).toHaveBeenCalledTimes(1);
    await flush();
    expect(opened).toHaveLength(1);
    expect(opened[0][0].name).toBe('late.docx');
  });

  it('uses bridge.statFile via getLastModified() in changedOnDisk and acceptDiskVersion without reading full file', async () => {
    let mtime = 1000;
    const readFile = vi.fn(async (p: string) => ({
      path: p,
      name: 'big.docx',
      bytes: new Uint8Array([1, 2, 3]),
      lastModified: mtime,
    }));
    const statFile = vi.fn(async () => ({ lastModified: mtime }));
    const bridge: DesktopBridge = {
      consumeLaunchFiles: vi.fn(async () => ['/tmp/big.docx']),
      onOpenFiles: vi.fn(() => () => {}),
      readFile,
      statFile,
      writeFile: vi.fn(async () => ({ lastModified: 3000 })),
    };

    const opened: File[] = [];
    registerFileLaunch(desktopLaunchQueue(bridge), (files) => {
      opened.push(...files);
    });
    await flush();
    await flush();

    const handle = handleOf(opened[0])!;
    expect(readFile).toHaveBeenCalledTimes(1);

    expect(await changedOnDisk(handle)).toBe(false);
    expect(statFile).toHaveBeenCalledWith('/tmp/big.docx');
    expect(readFile).toHaveBeenCalledTimes(1);

    mtime = 2000;
    expect(await changedOnDisk(handle)).toBe(true);
    await acceptDiskVersion(handle);
    expect(await changedOnDisk(handle)).toBe(false);
    expect(readFile).toHaveBeenCalledTimes(1);

    // Falls back to getFile().lastModified when statFile is absent.
    const noStatBridge: DesktopBridge = {
      consumeLaunchFiles: vi.fn(async () => []),
      onOpenFiles: vi.fn(() => () => {}),
      readFile,
      writeFile: vi.fn(async () => ({ lastModified: 3000 })),
    };
    const fallbackHandle = createDesktopFileHandle(noStatBridge, '/tmp/big.docx') as FileSystemFileHandle & {
      getLastModified?: () => Promise<number>;
    };
    expect(await fallbackHandle.getLastModified?.()).toBe(2000);
    expect(readFile).toHaveBeenCalledTimes(2);
  });
});

describe('manifest.webmanifest file handling', () => {
  const publicDir = path.resolve(__dirname, '../../public');
  const manifestPath = path.join(publicDir, 'manifest.webmanifest');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    scope: string;
    launch_handler?: { client_mode?: string };
    file_handlers?: Array<{
      action: string;
      name?: string;
      launch_type?: string;
      accept: Record<string, string[]>;
      icons?: Array<{ src: string; sizes?: string; type?: string }>;
    }>;
  };

  it('opens a new window per launched file and assigns an existing icon to each handler', () => {
    expect(manifest.launch_handler?.client_mode).toBe('navigate-new');
    expect(manifest.file_handlers?.length).toBeGreaterThan(0);
    for (const handler of manifest.file_handlers ?? []) {
      expect(handler.action).toBe('/');
      expect(handler.launch_type).toBe('multiple-clients');
      expect(handler.name?.trim().length).toBeGreaterThan(0);
      expect(handler.icons?.length).toBeGreaterThan(0);
      for (const icon of handler.icons ?? []) {
        expect(icon.src).toMatch(/^\/icons\/file-[a-z]+\.png$/);
        expect(icon.type).toBe('image/png');
        const iconDiskPath = path.join(publicDir, icon.src.replace(/^\//, ''));
        expect(existsSync(iconDiskPath)).toBe(true);
      }
    }
  });

  it('registers only supported Office and HWP extensions without duplicates', () => {
    const seen = new Set<string>();
    for (const handler of manifest.file_handlers ?? []) {
      for (const [mime, exts] of Object.entries(handler.accept)) {
        expect(mime).toMatch(/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/i);
        expect(exts.length).toBeGreaterThan(0);
        for (const ext of exts) {
          expect(ext).toMatch(/^\.[a-z0-9]+$/);
          expect(seen.has(ext)).toBe(false);
          seen.add(ext);
          const sample = `sample${ext}`;
          expect(isOffice(sample) || isHwp(sample)).toBe(true);
        }
      }
    }

    for (const required of ['.docx', '.xlsx', '.pptx', '.hwp', '.hwpx']) {
      expect(seen.has(required)).toBe(true);
    }
  });
});
