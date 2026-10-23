import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/*/src/**/*.test.ts', 'apps/api/src/**/*.test.ts'],
    // Each API test file boots its own PGlite (Postgres in WASM); give it room on a busy machine.
    hookTimeout: 30_000,
  },
});
