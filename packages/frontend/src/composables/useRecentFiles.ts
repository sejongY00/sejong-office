import { ref } from 'vue';
import { createDesktopFileHandle, type DesktopFileSystemFileHandle } from '@/pwa/fileLaunch';
import { handleOf, readFromDisk } from '@/utils/fileAccess';

export const MAX_RECENT_FILES = 5;
const RECENT_FILES_STORAGE_KEY = 'sejong_recent_files_v1';
const RECENT_FILES_DISABLED_KEY = 'sejong_recent_files_disabled_v1';
const RECENT_HANDLES_DB_NAME = 'sejong_recent_files_db';
const RECENT_HANDLES_STORE = 'handles';

export interface RecentFileEntry {
  id: string;
  name: string;
  path?: string;
  openedAt: number;
}

type PermissionCapableHandle = FileSystemFileHandle & {
  queryPermission?(desc: { mode: 'read' | 'readwrite' }): Promise<PermissionState>;
  requestPermission?(desc: { mode: 'read' | 'readwrite' }): Promise<PermissionState>;
};

const memoryHandles = new Map<string, FileSystemFileHandle>();

function readDisabledFromStorage(): boolean {
  try {
    return localStorage.getItem(RECENT_FILES_DISABLED_KEY) === '1';
  } catch {
    return false;
  }
}

function readEntriesFromStorage(): RecentFileEntry[] {
  try {
    const raw = localStorage.getItem(RECENT_FILES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is RecentFileEntry =>
          Boolean(
            item &&
              typeof item === 'object' &&
              typeof item.id === 'string' &&
              typeof item.name === 'string' &&
              typeof item.openedAt === 'number',
          ),
      )
      .slice(0, MAX_RECENT_FILES);
  } catch {
    return [];
  }
}

function writeEntriesToStorage(entries: readonly RecentFileEntry[]): void {
  try {
    if (!entries.length) {
      localStorage.removeItem(RECENT_FILES_STORAGE_KEY);
    } else {
      localStorage.setItem(
        RECENT_FILES_STORAGE_KEY,
        JSON.stringify(entries.slice(0, MAX_RECENT_FILES)),
      );
    }
  } catch {
    // Ignore storage quota errors
  }
}

function openHandlesDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(RECENT_HANDLES_DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(RECENT_HANDLES_STORE)) {
          db.createObjectStore(RECENT_HANDLES_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function saveHandleToIdb(id: string, handle: FileSystemFileHandle): Promise<void> {
  const db = await openHandlesDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(RECENT_HANDLES_STORE, 'readwrite');
      tx.objectStore(RECENT_HANDLES_STORE).put(handle, id);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    } catch {
      db.close();
      resolve();
    }
  });
}

async function loadHandleFromIdb(id: string): Promise<FileSystemFileHandle | null> {
  const db = await openHandlesDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(RECENT_HANDLES_STORE, 'readonly');
      const req = tx.objectStore(RECENT_HANDLES_STORE).get(id);
      req.onsuccess = () => {
        db.close();
        resolve((req.result as FileSystemFileHandle | undefined) ?? null);
      };
      req.onerror = () => {
        db.close();
        resolve(null);
      };
    } catch {
      db.close();
      resolve(null);
    }
  });
}

async function deleteHandleFromIdb(id: string): Promise<void> {
  const db = await openHandlesDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(RECENT_HANDLES_STORE, 'readwrite');
      tx.objectStore(RECENT_HANDLES_STORE).delete(id);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    } catch {
      db.close();
      resolve();
    }
  });
}

async function clearHandlesInIdb(): Promise<void> {
  const db = await openHandlesDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(RECENT_HANDLES_STORE, 'readwrite');
      tx.objectStore(RECENT_HANDLES_STORE).clear();
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    } catch {
      db.close();
      resolve();
    }
  });
}

const recentFilesDisabled = ref<boolean>(readDisabledFromStorage());
const recentFiles = ref<RecentFileEntry[]>(
  recentFilesDisabled.value ? [] : readEntriesFromStorage(),
);

function createInMemoryFileHandle(file: File): FileSystemFileHandle {
  return {
    kind: 'file',
    name: file.name,
    async getFile() {
      return file;
    },
  } as unknown as FileSystemFileHandle;
}

/**
 * Record an opened or saved file in the recent files list (capped at 5 items).
 * Does nothing when recent files are disabled by the user.
 */
export function recordRecentFile(input: {
  name: string;
  file?: File | null;
  handle?: FileSystemFileHandle | null;
  path?: string;
}): void {
  if (recentFilesDisabled.value) return;
  const trimmedName = input.name?.trim();
  if (!trimmedName) return;

  const rawHandle = input.handle ?? handleOf(input.file);
  const desktopPath =
    input.path?.trim() ||
    (rawHandle as DesktopFileSystemFileHandle | null)?.desktopPath?.trim() ||
    (input.file && window.sejongDesktop?.getFilePath?.(input.file)?.trim()) ||
    undefined;

  const id = desktopPath ? `path:${desktopPath}` : `name:${trimmedName}`;
  const entry: RecentFileEntry = {
    id,
    name: trimmedName,
    ...(desktopPath ? { path: desktopPath } : {}),
    openedAt: Date.now(),
  };

  let effectiveHandle: FileSystemFileHandle | null = rawHandle ?? null;
  if (!effectiveHandle && desktopPath && window.sejongDesktop) {
    effectiveHandle = createDesktopFileHandle(window.sejongDesktop, desktopPath);
  } else if (!effectiveHandle && input.file) {
    effectiveHandle = createInMemoryFileHandle(input.file);
  }

  if (effectiveHandle) {
    memoryHandles.set(id, effectiveHandle);
    if (!desktopPath && rawHandle) {
      void saveHandleToIdb(id, rawHandle);
    }
  }

  const next = [
    entry,
    ...recentFiles.value.filter(
      (existing) => existing.id !== id && (desktopPath || existing.name !== trimmedName),
    ),
  ];
  const kept = next.slice(0, MAX_RECENT_FILES);
  const removed = next.slice(MAX_RECENT_FILES);
  for (const old of removed) {
    memoryHandles.delete(old.id);
    void deleteHandleFromIdb(old.id);
  }

  recentFiles.value = kept;
  writeEntriesToStorage(kept);
}

/**
 * Remove a single entry from the recent files list.
 */
export function removeRecentFile(id: string): void {
  recentFiles.value = recentFiles.value.filter((item) => item.id !== id);
  memoryHandles.delete(id);
  writeEntriesToStorage(recentFiles.value);
  void deleteHandleFromIdb(id);
}

/**
 * Clear all recent files.
 */
export function clearRecentFiles(): void {
  recentFiles.value = [];
  memoryHandles.clear();
  writeEntriesToStorage([]);
  void clearHandlesInIdb();
}

/**
 * Enable or disable recent file tracking. Disabling also clears existing recent file history.
 */
export function setRecentFilesDisabled(disabled: boolean): void {
  recentFilesDisabled.value = disabled;
  try {
    if (disabled) {
      localStorage.setItem(RECENT_FILES_DISABLED_KEY, '1');
    } else {
      localStorage.removeItem(RECENT_FILES_DISABLED_KEY);
    }
  } catch {
    // Ignore storage errors
  }
  if (disabled) {
    clearRecentFiles();
  }
}

async function ensureHandlePermission(handle: FileSystemFileHandle): Promise<boolean> {
  const h = handle as PermissionCapableHandle;
  if (typeof h.queryPermission !== 'function') return true;
  try {
    if ((await h.queryPermission({ mode: 'readwrite' })) === 'granted') return true;
    if ((await h.queryPermission({ mode: 'read' })) === 'granted') return true;
  } catch {
    // Fall through to requestPermission
  }
  if (typeof h.requestPermission !== 'function') return true;
  try {
    if ((await h.requestPermission({ mode: 'readwrite' })) === 'granted') return true;
    return (await h.requestPermission({ mode: 'read' })) === 'granted';
  } catch {
    return false;
  }
}

/**
 * Re-open a recent file entry from disk, preserving its `FileSystemFileHandle` for in-place Save.
 */
export async function resolveRecentFile(entry: RecentFileEntry): Promise<File> {
  if (entry.path && window.sejongDesktop) {
    const handle = createDesktopFileHandle(window.sejongDesktop, entry.path);
    return readFromDisk(handle);
  }

  let handle = memoryHandles.get(entry.id) ?? null;
  if (!handle) {
    handle = await loadHandleFromIdb(entry.id);
    if (handle) memoryHandles.set(entry.id, handle);
  }

  if (!handle) {
    throw new Error(
      `"${entry.name}" 파일의 접근 정보를 찾을 수 없습니다. 파일을 직접 다시 선택해 열어 주세요.`,
    );
  }

  const permitted = await ensureHandlePermission(handle);
  if (!permitted) {
    throw new Error(`"${entry.name}" 파일 읽기 권한이 거부되었습니다.`);
  }

  return readFromDisk(handle);
}

export function useRecentFiles() {
  return {
    recentFiles,
    recentFilesDisabled,
    recordRecentFile,
    removeRecentFile,
    clearRecentFiles,
    setRecentFilesDisabled,
    resolveRecentFile,
  };
}
