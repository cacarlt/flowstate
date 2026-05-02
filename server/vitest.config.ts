import { defineConfig, defaultExclude } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/__tests__/setup.ts'],
    exclude: [...defaultExclude, '**/dist/**'],
    pool: 'forks',
    forks: {
      singleFork: true,
    },
    sequence: {
      concurrent: false,
    },
  },
});
