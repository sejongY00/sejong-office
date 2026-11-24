import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  hasAnyUnsavedChanges,
  registerUnsavedChecker,
} from './useUnsavedGuard';

describe('registerUnsavedChecker / hasAnyUnsavedChanges', () => {
  const cleanups: Array<() => void> = [];

  afterEach(() => {
    while (cleanups.length > 0) {
      cleanups.pop()?.();
    }
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
