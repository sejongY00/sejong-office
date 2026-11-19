import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';

const PLACEHOLDER = '__BUILD_ID__';

/** Same build output, same id; any changed file name (Vite hashes contents into names) changes it. */
export function buildIdFor(fileNames: Iterable<string>): string {
  return createHash('sha256')
    .update(Array.from(fileNames).sort().join('\n'))
    .digest('hex')
    .slice(0, 12);
}

export function injectBuildId(source: string, buildId: string): string {
  if (!source.includes(PLACEHOLDER)) {
    throw new Error(`service worker source has no ${PLACEHOLDER}`);
  }
  return source.split(PLACEHOLDER).join(buildId);
}

/**
 * Emits build/sw.js as /sw.js with a per-release cache name. A changed sw.js is also what makes
 * the browser install the new worker, which drives the "새 버전" prompt in the app.
 * Build only: the dev server never registers the worker.
 */
export function serviceWorkerPlugin(): Plugin {
  const sourcePath = path.resolve(__dirname, 'sw.js');
  return {
    name: 'sejong-service-worker',
    apply: 'build',
    generateBundle(_, bundle) {
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: injectBuildId(readFileSync(sourcePath, 'utf8'), buildIdFor(Object.keys(bundle))),
      });
    },
  };
}
