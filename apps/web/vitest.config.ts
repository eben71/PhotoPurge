import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './vitest.setup.ts',
    coverage: {
      reporter: ['text', 'lcov', 'json-summary'],
      provider: 'v8',
      lines: 80
    }
  },
  resolve: {
    alias: {
      '@photoprune/shared': path.resolve(__dirname, '../../packages/shared/src')
    }
  }
});
