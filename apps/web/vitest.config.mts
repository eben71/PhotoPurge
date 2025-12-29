import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './vitest.setup.ts',
    globals: true,
    coverage: {
      reporter: ['text', 'lcov', 'json-summary'],
      provider: 'v8',
      exclude: [
        '.next/**/*',
        'coverage/**/*',
        'dist/**/*',
        'next-env.d.ts',
        'next.config.js',
        'vitest.config.mts',
        'vitest.setup.ts',
        'app/layout.tsx'
      ],
      thresholds: {
        lines: 80
      }
    }
  },
  resolve: {
    alias: {
      '@photoprune/shared': resolve(__dirname, '../../packages/shared/src')
    }
  }
});
