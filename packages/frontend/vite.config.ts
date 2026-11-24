import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'node:path';
import { serviceWorkerPlugin } from './build/serviceWorker';

function resolveAppVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf8')) as {
      version?: string;
    };
    if (pkg.version) return pkg.version;
  } catch {
    // Fallback below
  }
  return '0.0.0';
}

function resolveAppUpdatedAt(): string {
  try {
    const iso = execFileSync('git', ['log', '-1', '--format=%cI'], {
      cwd: __dirname,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (iso) return iso;
  } catch {
    // Fallback when built outside a git checkout
  }
  return new Date().toISOString();
}

export default defineConfig(({ mode }) => {
  const isDesktopBuild = mode === 'desktop';
  return {
    define: {
      __DESKTOP_ONLY__: JSON.stringify(isDesktopBuild),
      __APP_VERSION__: JSON.stringify(resolveAppVersion()),
      __APP_UPDATED_AT__: JSON.stringify(resolveAppUpdatedAt()),
    },
    plugins: isDesktopBuild ? [vue()] : [vue(), serviceWorkerPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    optimizeDeps: {
      exclude: ['ppu-paddle-ocr', 'onnxruntime-web'],
    },
    server: {
      port: 5173,
      fs: {
        allow: [path.resolve(__dirname, '../..')],
      },
    },
    build: {
      outDir: path.resolve(__dirname, 'dist'),
      emptyOutDir: true,
    },
    assetsInclude: ['**/*.onnx', '**/*.ort', '**/*.wasm'],
  };
});
