import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadThemePreference, saveThemePreference } from './themePreference';

describe('Excalidraw theme preference', () => {
  beforeEach(() => localStorage.clear());

  it('follows the system until the user picks a theme', () => {
    expect(loadThemePreference()).toBeNull();
  });

  it('remembers the picked theme', () => {
    saveThemePreference('dark');
    expect(loadThemePreference()).toBe('dark');
    saveThemePreference('light');
    expect(loadThemePreference()).toBe('light');
  });

  it('ignores a stored value it does not know', () => {
    localStorage.setItem('sejong-office:excalidraw-theme', 'sepia');
    expect(loadThemePreference()).toBeNull();
  });

  it('keeps working when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    expect(() => saveThemePreference('dark')).not.toThrow();
    expect(loadThemePreference()).toBeNull();
  });
});
