import { cp, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const rootDir = path.resolve(frontendDir, '../..');
const nodeModules = path.join(rootDir, 'node_modules');
const publicDir = path.join(frontendDir, 'public');

const assets = [
  [
    '@mlightcad/cad-simple-viewer/dist/dxf-parser-worker.js',
    'assets/dxf-parser-worker.js',
  ],
  [
    '@mlightcad/cad-simple-viewer/dist/libredwg-parser-worker.js',
    'assets/libredwg-parser-worker.js',
  ],
  [
    '@mlightcad/cad-simple-viewer/dist/mtext-renderer-worker.js',
    'assets/mtext-renderer-worker.js',
  ],
  [
    'occt-import-js/dist/occt-import-js.wasm',
    'viewer-assets/wasm/occt-import-js.wasm',
  ],
  ['web-ifc/web-ifc.wasm', 'viewer-assets/wasm/web-ifc.wasm'],
];

await Promise.all(
  assets.map(async ([source, destination]) => {
    const output = path.join(publicDir, destination);
    await mkdir(path.dirname(output), { recursive: true });
    await cp(path.join(nodeModules, source), output);
  }),
);

const resources = path.join(publicDir, 'viewer-assets', 'cad-resources');
await mkdir(path.join(resources, 'fonts'), { recursive: true });
await mkdir(path.join(resources, 'templates'), { recursive: true });
await writeFile(path.join(resources, 'fonts.json'), '[]\n');
await writeFile(
  path.join(resources, 'README.txt'),
  [
    'Optional CAD fonts and templates can be placed here.',
    'Only files with redistribution rights should be added.',
    'The read-only viewer does not require a drawing template.',
    '',
  ].join('\n'),
);
