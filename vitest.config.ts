import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/*/src/**/*.test.ts', 'apps/api/src/**/*.test.ts'],
    // Each API test file boots its own PGlite (Postgres in WASM); give it room on a busy machine.
    hookTimeout: 30_000,
    // Password hashing is deliberately slow (scrypt at the OWASP cost); sign-in tests hash several times.
    testTimeout: 20_000,
  },
});
