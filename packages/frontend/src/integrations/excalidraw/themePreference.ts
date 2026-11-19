export type CanvasTheme = 'light' | 'dark';

const KEY = 'sejong-office:excalidraw-theme';

/** The theme picked in Excalidraw's menu, or null to follow the system. */
export function loadThemePreference(): CanvasTheme | null {
  try {
    const value = localStorage.getItem(KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    // Storage blocked (private window, site data off): just follow the system.
    return null;
  }
}

export function saveThemePreference(theme: CanvasTheme): void {
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // Not remembered this time; the choice still applies until the page closes.
  }
}
