import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {defineConfig} from 'vitest/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

export default defineConfig({
  resolve: {
    // The app-internal bridges that the Atom-era ModuleCache resolved at
    // runtime. In the vitest world they are plain aliases onto src/.
    alias: {
      'nylas-exports': path.join(root, 'src/global/nylas-exports.js'),
      'nylas-component-kit': path.join(root, 'src/global/nylas-component-kit.js'),
      'nylas-store': path.join(root, 'src/global/nylas-store.js'),
      'nylas-observables': path.join(root, 'src/global/nylas-observables.js'),
      // Vendored atom-era libraries (no maintained npm successor)
      reflux: path.join(root, 'src/vendor/reflux/dist/reflux.js'),
      'fs-plus': path.join(root, 'src/vendor/fs-plus/lib/fs-plus.js'),
      'event-kit': path.join(root, 'src/vendor/event-kit/dist/event-kit.js'),
      emissary: path.join(root, 'src/vendor/emissary/lib/emissary.js'),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['spec/**/*.spec.{js,jsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text'],
      include: ['src/**/*.js', 'src/**/*.jsx'],
      exclude: ['src/vendor/**'],
      thresholds: {lines: 60, functions: 45, statements: 60, branches: 45},
    },
  },
});
