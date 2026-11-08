// HWP/HWPX hand-off to RhwpEditorView. There is no server session any more: everything stays in
// this tab (sessionStorage), and leaving the page clears the staged file.

const HWP_FILE_KEY = 'sejong_hwp_file';
const HWP_OPEN_TOKEN_KEY = 'sejong_hwp_open_token';

let pageHideBound = false;

/** Register once for the whole SPA (survives keep-alive editor switches). */
export function bindSessionPageHideOnce() {
  if (pageHideBound || typeof window === 'undefined') return;
  pageHideBound = true;
  window.addEventListener('pagehide', clearHwpFile);
}

export function storeHwpFile(file: File): Promise<void> {
  return file.arrayBuffer().then((buffer) => {
    storeHwpBuffer(file.name, buffer);
  });
}

/** Bumps whenever a HWP/HWPX is staged for the editor (forces a fresh view). */
export function hwpOpenToken(): string {
  if (typeof sessionStorage === 'undefined') return '0';
  return sessionStorage.getItem(HWP_OPEN_TOKEN_KEY) ?? '0';
}

function bumpHwpOpenToken(): void {
  sessionStorage.setItem(HWP_OPEN_TOKEN_KEY, `${Date.now()}`);
}

export function storeHwpBuffer(name: string, buffer: ArrayBuffer): void {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  sessionStorage.setItem(
    HWP_FILE_KEY,
    JSON.stringify({
      name,
      base64: btoa(binary),
    }),
  );
  bumpHwpOpenToken();
}

export function loadHwpFile(): { name: string; buffer: ArrayBuffer } | null {
  const raw = sessionStorage.getItem(HWP_FILE_KEY);
  if (!raw) return null;
  try {
    const { name, base64 } = JSON.parse(raw) as {
      name: string;
      base64: string;
    };
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return { name, buffer: bytes.buffer };
  } catch {
    return null;
  }
}

export function clearHwpFile(): void {
  sessionStorage.removeItem(HWP_FILE_KEY);
  sessionStorage.removeItem(HWP_OPEN_TOKEN_KEY);
}
