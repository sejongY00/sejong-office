import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  confirmUnsavedChanges,
  hasAnyUnsavedChanges,
  registerUnsavedChecker,
} from './useUnsavedGuard';

describe('registerUnsavedChecker / hasAnyUnsavedChanges', () => {
  const cleanups: Array<() => void> = [];

  afterEach(() => {
    while (cleanups.length > 0) {
      cleanups.pop()?.();
    }
    delete window.sejongDesktop;
    vi.restoreAllMocks();
  });

  it('returns false when no checkers are registered or all are clean', async () => {
    expect(await hasAnyUnsavedChanges()).toBe(false);

    cleanups.push(registerUnsavedChecker(() => false));
    cleanups.push(registerUnsavedChecker(() => false));
    expect(await hasAnyUnsavedChanges()).toBe(false);
  });

  it('returns true when any registered checker reports dirty after async refresh', async () => {
    let dirty = false;
    const refresh = vi.fn(async () => {
      dirty = true;
    });

    cleanups.push(registerUnsavedChecker(() => false));
    cleanups.push(registerUnsavedChecker(() => dirty, refresh));

    expect(await hasAnyUnsavedChanges()).toBe(true);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('stops reporting dirty once the checker is unregistered', async () => {
    const unregister = registerUnsavedChecker(() => true);
    cleanups.push(unregister);

    expect(await hasAnyUnsavedChanges()).toBe(true);
    unregister();
    expect(await hasAnyUnsavedChanges()).toBe(false);
  });
});

describe('confirmUnsavedChanges', () => {
  afterEach(() => {
    delete window.sejongDesktop;
    vi.restoreAllMocks();
  });

  it('uses desktop native dialog bridge when sejongDesktop.confirmUnsavedChanges is available', async () => {
    const desktopConfirm = vi.fn(async () => false).mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const windowConfirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    window.sejongDesktop = {
      isDesktop: true,
      consumeLaunchFiles: vi.fn(async () => []),
      onOpenFiles: vi.fn(() => () => {}),
      readFile: vi.fn(),
      statFile: vi.fn(),
      writeFile: vi.fn(),
      confirmUnsavedChanges: desktopConfirm,
    };

    expect(await confirmUnsavedChanges()).toBe(false);
    expect(await confirmUnsavedChanges()).toBe(true);
    expect(desktopConfirm).toHaveBeenCalledTimes(2);
    expect(windowConfirm).not.toHaveBeenCalled();
  });

  it('falls back to window.confirm in web environments', async () => {
    const windowConfirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);

    expect(await confirmUnsavedChanges()).toBe(false);
    expect(await confirmUnsavedChanges()).toBe(true);
    expect(windowConfirm).toHaveBeenNthCalledWith(
      1,
      '저장하지 않은 수정이 있습니다. 저장하지 않고 계속할까요?',
    );
    expect(windowConfirm).toHaveBeenNthCalledWith(
      2,
      '저장하지 않은 수정이 있습니다. 저장하지 않고 계속할까요?',
    );
  });
});
