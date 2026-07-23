import { defineConfig } from 'vite';
import { configDefaults } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [path.resolve(__dirname, './vitest.setup.ts')],
    css: false,
    // Playwright specs live in e2e/ and run via `npm run test:e2e` —
    // keep them out of the Vitest runner.
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
});
