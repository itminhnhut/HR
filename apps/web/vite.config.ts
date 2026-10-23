import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// `--mode preview` builds a self-contained copy (hash routes, relative paths)
// that can be opened from any static host without server rewrites.
export default defineConfig(({ mode }) => ({
  base: mode === 'preview' ? './' : '/',
  plugins: [react(), tailwindcss()],
  build: { target: 'es2022', sourcemap: mode !== 'preview' },
  // With VITE_API_URL=/api in .env.local, `npm run dev:api` (port 8787) answers these paths.
  server: {
    proxy: Object.fromEntries(
      ['/api', '/share', '/sitemap.xml', '/robots.txt'].map((path) => [path, 'http://localhost:8787']),
    ),
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['src/test/setup.ts'],
  },
}));
