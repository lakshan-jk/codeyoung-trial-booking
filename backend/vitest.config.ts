import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Spinning up an in-memory Mongo replica set is slow on first run.
    testTimeout: 60_000,
    hookTimeout: 120_000,
    // DB-backed tests share one Mongo connection, so don't run files in parallel.
    fileParallelism: false,
  },
});
