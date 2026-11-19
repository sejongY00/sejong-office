import { describe, expect, it } from 'vitest';
import router from './index';

describe('router', () => {
  it.each([
    ['/', 'home'],
    ['/editor/office', 'office-editor'],
    ['/editor/rhwp', 'rhwp-editor'],
    ['/tools/scanner', 'tools-scanner'],
    ['/licenses', 'licenses'],
  ])('resolves %s to %s', (path, name) => {
    expect(router.resolve(path).name).toBe(name);
  });

  it.each(['/foo', '/editor', '/editor/unknown', '/tools/scanner/extra'])(
    'sends unknown path %s to the not-found page',
    (path) => {
      const resolved = router.resolve(path);
      expect(resolved.name).toBe('not-found');
      expect(resolved.matched).toHaveLength(1);
    },
  );
});
