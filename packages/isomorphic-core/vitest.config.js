import {defineConfig} from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['spec/**/*.spec.js'],
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text'],
      include: ['src/**/*.js'],
      thresholds: {
        lines: 80,
        functions: 60,
        statements: 80,
        branches: 60,
      },
    },
  },
});
