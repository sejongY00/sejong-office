import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { withTimeout } from './withTimeout';

describe('withTimeout', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('resolves with the value when the promise settles in time', async () => {
    const result = withTimeout(Promise.resolve('ok'), 1000, 'late');
    await expect(result).resolves.toBe('ok');
  });

  it('passes the original rejection through', async () => {
    const result = withTimeout(Promise.reject(new Error('boom')), 1000, 'late');
    await expect(result).rejects.toThrow('boom');
  });

  it('rejects with the given message when the promise never settles', async () => {
    const result = withTimeout(new Promise(() => {}), 1000, '응답 없음');
    const assertion = expect(result).rejects.toThrow('응답 없음');
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
  });

  it('does not fire before the deadline', async () => {
    let settled = false;
    void withTimeout(new Promise(() => {}), 1000, 'late').catch(() => {
      settled = true;
    });
    await vi.advanceTimersByTimeAsync(999);
    expect(settled).toBe(false);
  });
});
