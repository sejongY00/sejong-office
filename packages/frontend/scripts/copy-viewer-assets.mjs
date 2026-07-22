import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const rootDir = path.resolve(frontendDir, '../..');
const publicDir = path.join(frontendDir, 'public');

function resolvePackage(...parts) {
  const candidates = [
    path.join(frontendDir, 'node_modules', ...parts),
    path.join(rootDir, 'node_modules', ...parts),
  ];
  return candidates;
}

async function copyFirst(sources, destination) {
  const output = path.join(publicDir, destination);
  await mkdir(path.dirname(output), { recursive: true });
  let lastError;
  for (const source of sources) {
    try {
      await cp(source, output);
      return output;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error(`Missing asset for ${destination}`);
}

const cadAssets = [
  [
    resolvePackage('@mlightcad/cad-simple-viewer/dist/dxf-parser-worker.js'),
    'assets/dxf-parser-worker.js',
  ],
  [
    resolvePackage(
      '@mlightcad/cad-simple-viewer/dist/libredwg-parser-worker.js',
    ),
    'assets/libredwg-parser-worker.js',
  ],
  [
    resolvePackage(
      '@mlightcad/cad-simple-viewer/dist/mtext-renderer-worker.js',
    ),
    'assets/mtext-renderer-worker.js',
  ],
  [
    resolvePackage('@noto-pdf-ts/fonts-kr/dist/fonts/NotoSansKR-VF.ttf'),
    'viewer-assets/cad-resources/fonts/NotoSansKR-VF.ttf',
  ],
  [
    resolvePackage('@fontsource-variable/noto-sans-kr/LICENSE'),
    'viewer-assets/cad-resources/fonts/OFL-1.1.txt',
  ],
];

const o3dvAssets = [
  [
    resolvePackage('rhino3dm/rhino3dm.min.js'),
    'viewer-assets/o3dv/rhino3dm.min.js',
  ],
  [
    resolvePackage('rhino3dm/rhino3dm.wasm'),
    'viewer-assets/o3dv/rhino3dm.wasm',
  ],
  [
    resolvePackage('web-ifc/web-ifc-api-iife.js'),
    'viewer-assets/o3dv/web-ifc-api-iife.js',
  ],
  [resolvePackage('web-ifc/web-ifc.wasm'), 'viewer-assets/o3dv/web-ifc.wasm'],
  [
    resolvePackage('draco3d/draco_decoder_nodejs.js'),
    'viewer-assets/o3dv/draco_decoder_nodejs.min.js',
  ],
  [
    resolvePackage('occt-import-js/dist/occt-import-js.js'),
    'viewer-assets/o3dv/occt-import-js.js',
  ],
  [
    resolvePackage('occt-import-js/dist/occt-import-js-worker.js'),
    'viewer-assets/o3dv/occt-import-js-worker.js',
  ],
  [
    resolvePackage('occt-import-js/dist/occt-import-js.wasm'),
    'viewer-assets/o3dv/occt-import-js.wasm',
  ],
  [
    resolvePackage('occt-import-js/dist/license.occt-import-js.txt'),
    'viewer-assets/o3dv/licenses/license.occt-import-js.txt',
  ],
  [
    resolvePackage('occt-import-js/dist/license.occt.txt'),
    'viewer-assets/o3dv/licenses/license.occt.txt',
  ],
  [
    resolvePackage('online-3d-viewer/LICENSE.md'),
    'viewer-assets/o3dv/licenses/online-3d-viewer.LICENSE.md',
  ],
  [
    resolvePackage('rhino3dm/README.md'),
    'viewer-assets/o3dv/licenses/rhino3dm.README.md',
  ],
];

await Promise.all(
  [...cadAssets, ...o3dvAssets].map(([sources, destination]) =>
    copyFirst(sources, destination),
  ),
);

const envmapCandidates = resolvePackage(
  'online-3d-viewer/website/assets/envmaps/fishermans_bastion',
);
const envmapDest = path.join(
  publicDir,
  'viewer-assets/o3dv/envmaps/fishermans_bastion',
);
await mkdir(path.dirname(envmapDest), { recursive: true });
{
  let copied = false;
  for (const candidate of envmapCandidates) {
    try {
      await cp(candidate, envmapDest, { recursive: true });
      copied = true;
      break;
    } catch {
      // try next
    }
  }
  if (!copied) {
    throw new Error('Missing Online3DViewer envmap assets');
  }
}

const resources = path.join(publicDir, 'viewer-assets', 'cad-resources');
await mkdir(path.join(resources, 'fonts'), { recursive: true });
await mkdir(path.join(resources, 'templates'), { recursive: true });
const fontManifest = `${JSON.stringify(
  [
    {
      name: [
        'Noto Sans KR',
        'arial',
        'batang',
        'dotum',
        'ghs',
        'gulim',
        'hztxt',
        'isocpeur',
        'malgun',
        'malgun gothic',
        'pmingliu',
        'romans',
        'sanss___',
        'simplex',
        'swisscbo',
        'whgtxt',
        'whs',
      ],
      file: 'NotoSansKR-VF.ttf',
      type: 'mesh',
      description: 'Open-source Korean CAD fallback (SIL OFL 1.1)',
    },
  ],
  null,
  2,
)}\n`;
await Promise.all([
  writeFile(path.join(resources, 'fonts.json'), fontManifest),
  writeFile(path.join(resources, 'fonts', 'fonts.json'), fontManifest),
]);
await writeFile(
  path.join(resources, 'README.txt'),
  [
    'Noto Sans KR is bundled as the open-source Korean CAD fallback.',
    'Additional CAD fonts may be placed here when redistribution is permitted.',
    'The read-only viewer does not require a drawing template.',
    '',
  ].join('\n'),
);

await writeFile(
  path.join(publicDir, 'viewer-assets/o3dv/README.txt'),
  [
    'Self-hosted Online3DViewer external libraries.',
    'CDN URLs in online-3d-viewer are rewritten to /viewer-assets/o3dv/.',
    '',
  ].join('\n'),
);

const scannerAssets = [
  [resolvePackage('jscanify/src/opencv.js'), 'viewer-assets/scanner/opencv.js'],
  [resolvePackage('jscanify/src/jscanify.js'), 'viewer-assets/scanner/jscanify.js'],
  [resolvePackage('jscanify/LICENSE'), 'viewer-assets/scanner/licenses/jscanify.LICENSE'],
  [
    resolvePackage('ppu-paddle-ocr/LICENSE'),
    'viewer-assets/scanner/licenses/ppu-paddle-ocr.LICENSE',
  ],
  [
    resolvePackage('pdfjs-dist/build/pdf.worker.min.mjs'),
    'viewer-assets/scanner/pdfjs/pdf.worker.min.mjs',
  ],
  [
    resolvePackage('pdfjs-dist/LICENSE'),
    'viewer-assets/scanner/licenses/pdfjs-dist.LICENSE',
  ],
];

await Promise.all(
  scannerAssets.map(([sources, destination]) =>
    copyFirst(sources, destination),
  ),
);

{
  const { access, readdir, rm } = await import('node:fs/promises');
  const legacyTesseract = path.join(publicDir, 'viewer-assets/scanner/tesseract');
  try {
    await rm(legacyTesseract, { recursive: true, force: true });
  } catch {
    // ignore
  }

  const ortDest = path.join(publicDir, 'viewer-assets/scanner/ort');
  await mkdir(ortDest, { recursive: true });
  const ortNames = [
    'ort-wasm-simd-threaded.wasm',
    'ort-wasm-simd-threaded.mjs',
    'ort-wasm-simd-threaded.jsep.wasm',
    'ort-wasm-simd-threaded.jsep.mjs',
  ];
  let ortCopied = false;
  for (const candidate of resolvePackage('onnxruntime-web/dist')) {
    try {
      const entries = await readdir(candidate);
      const wanted = ortNames.filter((name) => entries.includes(name));
      if (wanted.length < ortNames.length) continue;
      await Promise.all(
        wanted.map((name) =>
          cp(path.join(candidate, name), path.join(ortDest, name)),
        ),
      );
      ortCopied = true;
      break;
    } catch {
      // try next
    }
  }
  if (!ortCopied) {
    throw new Error('Missing onnxruntime-web WASM assets');
  }

  const paddleDest = path.join(publicDir, 'viewer-assets/scanner/paddle');
  await mkdir(paddleDest, { recursive: true });
  const modelCacheDir = path.join(frontendDir, '.cache', 'paddle-ocr-models');
  await mkdir(modelCacheDir, { recursive: true });

  const MODEL_BASE =
    'https://media.githubusercontent.com/media/PT-Perkasa-Pilar-Utama/ppu-paddle-ocr-models/main';
  const DICT_BASE =
    'https://raw.githubusercontent.com/PT-Perkasa-Pilar-Utama/ppu-paddle-ocr-models/main';
  const paddleFiles = [
    {
      url: `${MODEL_BASE}/detection/PP-OCRv5_mobile_det_infer.onnx`,
      name: 'PP-OCRv5_mobile_det_infer.onnx',
    },
    {
      url: `${MODEL_BASE}/recognition/multi/korean/v5/korean_PP-OCRv5_mobile_rec_infer.onnx`,
      name: 'korean_PP-OCRv5_mobile_rec_infer.onnx',
    },
    {
      url: `${DICT_BASE}/recognition/multi/korean/v5/ppocrv5_korean_dict.txt`,
      name: 'ppocrv5_korean_dict.txt',
    },
  ];

  async function downloadToCache(url, name) {
    const cached = path.join(modelCacheDir, name);
    try {
      await access(cached);
      return cached;
    } catch {
      // download
    }
    console.log(`downloading paddle model: ${name}`);
    let lastError;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status} for ${url}`);
        }
        const buffer = Buffer.from(await response.arrayBuffer());
        if (buffer.byteLength < 64) {
          throw new Error(`Unexpectedly small download for ${name}`);
        }
        await writeFile(cached, buffer);
        return cached;
      } catch (error) {
        lastError = error;
        console.warn(`retry ${attempt}/3 failed for ${name}:`, error);
      }
    }
    throw lastError ?? new Error(`Failed to download ${name}`);
  }

  for (const file of paddleFiles) {
    const cachedPath = await downloadToCache(file.url, file.name);
    await cp(cachedPath, path.join(paddleDest, file.name));
  }

  await writeFile(
    path.join(publicDir, 'viewer-assets/scanner/licenses/paddle-ocr-models.NOTICE.txt'),
    [
      'PP-OCRv5 ONNX models are sourced from:',
      'https://github.com/PT-Perkasa-Pilar-Utama/ppu-paddle-ocr-models',
      'upstream: https://www.paddleocr.ai/ (Apache-2.0)',
      '',
    ].join('\n'),
  );
}

await writeFile(
  path.join(publicDir, 'viewer-assets/scanner/README.txt'),
  [
    'Self-hosted document scanner libraries (OpenCV.js, jscanify, ppu-paddle-ocr, pdf.js).',
    'OCR: PP-OCRv5 Korean mobile (det + rec + dict) under paddle/.',
    'ONNX Runtime Web WASM under ort/.',
    'PDF.js worker under pdfjs/.',
    '',
  ].join('\n'),
);

const O3DV_BASE = '/viewer-assets/o3dv/';
const replacements = [
  [
    'https://cdn.jsdelivr.net/npm/occt-import-js@0.0.22/dist/',
    O3DV_BASE,
  ],
  [
    'https://cdn.jsdelivr.net/npm/rhino3dm@8.17.0/rhino3dm.min.js',
    `${O3DV_BASE}rhino3dm.min.js`,
  ],
  [
    'https://cdn.jsdelivr.net/npm/web-ifc@0.0.68/web-ifc-api-iife.js',
    `${O3DV_BASE}web-ifc-api-iife.js`,
  ],
  [
    'https://cdn.jsdelivr.net/npm/draco3d@1.5.7/draco_decoder_nodejs.min.js',
    `${O3DV_BASE}draco_decoder_nodejs.min.js`,
  ],
];

async function patchO3dvFile(relativePath) {
  for (const candidate of resolvePackage(relativePath)) {
    try {
      let source = await readFile(candidate, 'utf8');
      let changed = false;
      for (const [from, to] of replacements) {
        if (source.includes(from)) {
          source = source.split(from).join(to);
          changed = true;
        }
      }
      if (changed) {
        await writeFile(candidate, source);
        console.log(`patched ${candidate}`);
      }
      return;
    } catch {
      // try next path
    }
  }
  throw new Error(`Could not patch ${relativePath}`);
}

await patchO3dvFile('online-3d-viewer/build/engine/o3dv.module.js');
await patchO3dvFile('online-3d-viewer/build/engine/o3dv.min.js');
