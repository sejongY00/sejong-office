import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default defineConfig((env) =>
  mergeConfig(
    typeof viteConfig === 'function' ? viteConfig(env) : viteConfig,
    {
      test: {
        environment: 'jsdom',
        include: ['src/**/*.test.ts', 'build/**/*.test.ts'],
        restoreMocks: true,
      },
    },
  ),
);
