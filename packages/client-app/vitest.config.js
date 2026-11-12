import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// client-app package root (this file lives at packages/client-app/)
const root = __dirname;

export default defineConfig({
	resolve: {
		// The app-internal bridges that the Atom-era ModuleCache resolved at
		// runtime. In the vitest world they are plain aliases onto src/.
		alias: {
			electron: path.join(__dirname, "spec/stubs/electron.js"),
			"@electron/remote": path.join(__dirname, "spec/stubs/electron-remote.js"),
			"nylas-exports": path.join(__dirname, "spec/stubs/nylas-exports.js"), // eager re-export for named-import analysis
			"nylas-component-kit": path.join(
				__dirname,
				"spec/stubs/nylas-component-kit.js",
			),
			"nylas-store": path.join(root, "src/global/nylas-store.js"),
			"nylas-observables": path.join(
				__dirname,
				"spec/stubs/nylas-observables.js",
			), // eager re-export for named-import analysis
			// Vendored atom-era libraries (no maintained npm successor)
			reflux: path.join(root, "src/vendor/reflux/dist/reflux.js"),
			"fs-plus": path.join(root, "src/vendor/fs-plus/lib/fs-plus.js"),
			"event-kit": path.join(root, "src/vendor/event-kit/dist/event-kit.js"),
			emissary: path.join(root, "src/vendor/emissary/lib/emissary.js"),
		},
	},
	test: {
		// Scope discovery to this package (a workspace root above would
		// otherwise pull sibling packages' spec dirs into this run).
		root: __dirname,
		environment: "jsdom",
		setupFiles: ["spec/setup.js"],
		include: ["spec/**/*.spec.{js,jsx}"],
		jsx: { mode: "automatic" },
		coverage: {
			provider: "v8",
			reporter: ["text"],
			include: ["src/**/*.js", "src/**/*.jsx"],
			exclude: ["src/vendor/**"],
			thresholds: { lines: 60, functions: 45, statements: 60, branches: 45 },
		},
	},
});
