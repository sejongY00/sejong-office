import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearRecentFiles,
  MAX_RECENT_FILES,
  recordRecentFile,
  removeRecentFile,
  resolveRecentFile,
  setRecentFilesDisabled,
  useRecentFiles,
} from './useRecentFiles';

describe('useRecentFiles', () => {
  beforeEach(() => {
    localStorage.clear();
    setRecentFilesDisabled(false);
    clearRecentFiles();
    delete window.sejongDesktop;
  });

  afterEach(() => {
    delete window.sejongDesktop;
  });

  it('stores up to 5 recent files in most-recent-first order and deduplicates existing entries', () => {
    const { recentFiles } = useRecentFiles();

    for (let i = 1; i <= 6; i += 1) {
      recordRecentFile({
        name: `문서${i}.docx`,
        path: `/Users/test/문서${i}.docx`,
      });
    }

    expect(recentFiles.value).toHaveLength(MAX_RECENT_FILES);
    expect(recentFiles.value.map((f) => f.name)).toEqual([
      '문서6.docx',
      '문서5.docx',
      '문서4.docx',
      '문서3.docx',
      '문서2.docx',
    ]);

    // Re-opening文書3 moves it to the top without increasing count
    recordRecentFile({
      name: '문서3.docx',
      path: '/Users/test/문서3.docx',
    });
    expect(recentFiles.value.map((f) => f.name)).toEqual([
      '문서3.docx',
      '문서6.docx',
      '문서5.docx',
      '문서4.docx',
      '문서2.docx',
    ]);
  });

  it('removes individual items and clears all items', () => {
    const { recentFiles } = useRecentFiles();

    recordRecentFile({ name: 'a.xlsx', path: '/tmp/a.xlsx' });
    recordRecentFile({ name: 'b.pptx', path: '/tmp/b.pptx' });
    expect(recentFiles.value).toHaveLength(2);

    removeRecentFile(recentFiles.value[0].id);
    expect(recentFiles.value.map((f) => f.name)).toEqual(['a.xlsx']);

    clearRecentFiles();
    expect(recentFiles.value).toHaveLength(0);
    expect(localStorage.getItem('sejong_recent_files_v1')).toBeNull();
  });

  it('clears history and ignores new entries when recent files are disabled', () => {
    const { recentFiles, recentFilesDisabled } = useRecentFiles();

    recordRecentFile({ name: '보고서.hwpx', path: '/tmp/보고서.hwpx' });
    expect(recentFiles.value).toHaveLength(1);

    setRecentFilesDisabled(true);
    expect(recentFilesDisabled.value).toBe(true);
    expect(recentFiles.value).toHaveLength(0);

    recordRecentFile({ name: '무시됨.docx', path: '/tmp/무시됨.docx' });
    expect(recentFiles.value).toHaveLength(0);

    setRecentFilesDisabled(false);
    expect(recentFilesDisabled.value).toBe(false);
    recordRecentFile({ name: '다시기록.docx', path: '/tmp/다시기록.docx' });
    expect(recentFiles.value.map((f) => f.name)).toEqual(['다시기록.docx']);
  });

  it('resolves a recent desktop file from disk through the Electron bridge', async () => {
    const { recentFiles } = useRecentFiles();
    const readFile = vi.fn(async (filePath: string) => ({
      path: filePath,
      name: '한글문서.hwpx',
      bytes: new Uint8Array([1, 2, 3, 4]),
      lastModified: 1700000000000,
    }));

    window.sejongDesktop = {
      isDesktop: true,
      consumeLaunchFiles: async () => [],
      onOpenFiles: () => () => {},
      readFile,
      statFile: async () => ({ lastModified: 1700000000000 }),
      writeFile: async () => ({ lastModified: 1700000000000 }),
    };

    recordRecentFile({
      name: '한글문서.hwpx',
      path: '/Users/test/Documents/한글문서.hwpx',
    });

    const resolved = await resolveRecentFile(recentFiles.value[0]);
    expect(readFile).toHaveBeenCalledWith('/Users/test/Documents/한글문서.hwpx');
    expect(resolved.name).toBe('한글문서.hwpx');
    expect(resolved.size).toBe(4);
  });
});
