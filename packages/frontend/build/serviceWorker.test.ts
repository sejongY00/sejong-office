import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildIdFor, injectBuildId } from './serviceWorker';

describe('buildIdFor', () => {
  it('is the same for the same build output in any order', () => {
    expect(buildIdFor(['assets/a-1.js', 'index.html'])).toBe(
      buildIdFor(['index.html', 'assets/a-1.js']),
    );
  });

  it('changes when any hashed file name changes', () => {
    expect(buildIdFor(['assets/a-1.js', 'index.html'])).not.toBe(
      buildIdFor(['assets/a-2.js', 'index.html']),
    );
  });
});

describe('injectBuildId', () => {
  it('fills the cache name in the real service worker', () => {
    const source = readFileSync(path.resolve(__dirname, 'sw.js'), 'utf8');
    const out = injectBuildId(source, 'abc123');
    expect(out).toContain('sejong-office-abc123');
    expect(out).not.toContain('__BUILD_ID__');
  });

  it('refuses a source without the placeholder', () => {
    expect(() => injectBuildId('const CACHE = "x";', 'abc')).toThrow('__BUILD_ID__');
  });
});
