import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { isHwp, isOffice } from '@/config/app';
import { handleOf } from '@/utils/fileAccess';
import {
  registerFileLaunch,
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
});

describe('manifest.webmanifest file handling', () => {
  const manifestPath = path.resolve(__dirname, '../../public/manifest.webmanifest');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    scope: string;
    launch_handler?: { client_mode?: string };
    file_handlers?: Array<{
      action: string;
      launch_type?: string;
      accept: Record<string, string[]>;
    }>;
  };

  it('opens a new window per launched file', () => {
    expect(manifest.launch_handler?.client_mode).toBe('navigate-new');
    expect(manifest.file_handlers?.length).toBeGreaterThan(0);
    for (const handler of manifest.file_handlers ?? []) {
      expect(handler.action).toBe('/');
      expect(handler.launch_type).toBe('multiple-clients');
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
