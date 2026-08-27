import {defineConfig} from 'vitest/config'
export default defineConfig({test: {environment: 'node', include: ['spec/**/*.spec.js'], coverage: {
  provider: 'v8', include: ['src/**/*.js', 'app.js'],
  thresholds: {lines: 80, functions: 60, statements: 80, branches: 60},
}}})
