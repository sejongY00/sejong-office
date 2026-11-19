import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'node:path';
import { serviceWorkerPlugin } from './build/serviceWorker';

export default defineConfig({
  plugins: [vue(), serviceWorkerPlugin()],
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
  },
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
  },
  assetsInclude: ['**/*.onnx', '**/*.ort', '**/*.wasm'],
});
