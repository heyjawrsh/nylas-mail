import path from 'node:path'
import {defineConfig} from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      'nylas-exports': path.resolve(__dirname, 'spec/stubs/nylas-exports.js'),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['spec/**/*.spec.js'],
    setupFiles: ['spec/setup.js'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.js'],
      thresholds: {
        lines: 60,
        functions: 45,
        statements: 60,
        branches: 45,
      },
    },
  },
})
