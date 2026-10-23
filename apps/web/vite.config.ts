import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// `--mode preview` builds a self-contained copy (hash routes, relative paths)
// that can be opened from any static host without server rewrites.
export default defineConfig(({ mode }) => ({
  base: mode === 'preview' ? './' : '/',
  plugins: [react(), tailwindcss()],
  build: { target: 'es2022', sourcemap: mode !== 'preview' },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['src/test/setup.ts'],
  },
}));
