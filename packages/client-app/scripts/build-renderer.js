// Bundles the renderer bootstrap graphs (mixed CJS/ESM sources) into classic
// scripts the Electron renderer can execute without a module loader. The 2017
// app did this at runtime via compile-cache (babel/coffee JIT); the modernized
// codebase does it once, ahead of launch, with esbuild.
import { build } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const BANNER = `
(function () {
	if (typeof window === "undefined" || window.NylasEnv) return;
	var qs = {};
	try {
		new URLSearchParams(window.location.search).forEach(function (v, k) { qs[k] = v; });
	} catch (e) {}
	window.NylasEnv = {
		loadSettings: qs,
		inSpecMode: function () { return qs.specMode === "1" || qs.specMode === "true"; },
		inDevMode: function () { return qs.devMode === "1" || qs.devMode === "true"; },
		inBenchmarkMode: function () { return false; },
		getConfigDirPath: function () { return qs.configDirPath || ""; },
		getResourcePath: function () { return qs.resourcePath || ""; },
		reportError: function () {},
		errorLogger: { reportError: function () {} },
		config: {
			get: function () { return null; },
			set: function () {},
			onDidChange: function () { return { dispose: function () {} }; },
			unobserve: function () {},
		},
		commands: { add: function () {}, onWillDispatch: function () { return { dispose: function () {} }; } },
		workspace: { open: function () {} },
		menu: { add: function () {} },
		packages: {
			pluginIdFor: function () { return null; },
			getPackage: function () { return null; },
			isPackageLoaded: function () { return false; },
			onDidActivateInitialPackages: function (cb) { setTimeout(cb, 0); return { dispose: function () {} }; },
		},
		keymaps: { add: function () {} },
		styles: { observeStyleElements: function () { return { dispose: function () {} }; } },
	};
})();
`;

const entries = [
	{
		in: path.join(root, "src/window-bootstrap.js"),
		out: "window-bootstrap.bundle",
	},
	{
		in: path.join(root, "src/secondary-window-bootstrap.js"),
		out: "secondary-window-bootstrap.bundle",
	},
];

for (const entry of entries) {
	await build({
		entryPoints: [entry.in],
		bundle: true,
		format: "cjs",
		platform: "node",
		target: "chrome130",
		outfile: path.join(root, "static", `${entry.out}.js`),
		// electron must stay external — it only exists inside the app runtime
		external: ["electron", "pg-hstore", "*.node"],
		// native / optional modules: stubbed for the renderer bundle
		alias: {
			keytar: path.join(root, "src/renderer-stubs/optional-native.js"),
			pathwatcher: path.join(root, "src/renderer-stubs/optional-native.js"),
			"electron-spellchecker": path.join(
				root,
				"src/renderer-stubs/optional-native.js",
			),
			"windows-shortcuts": path.join(
				root,
				"src/renderer-stubs/optional-native.js",
			),
			"node-uuid": "uuid",
		},
		// the alias bridges the old ModuleCache runtime resolution
		alias: {
			"nylas-exports": path.join(root, "src/global/nylas-exports.js"),
			"nylas-component-kit": path.join(
				root,
				"src/global/nylas-component-kit.js",
			),
			"nylas-store": path.join(root, "src/global/nylas-store.js"),
			"nylas-observables": path.join(root, "src/global/nylas-observables.js"),
			// internal packages load through their own package.json at runtime
			"internal_packages/*": "internal_packages/*",
		},
		logLevel: "warning",
		banner: {
			// The flux layer reads the NylasEnv global at module-evaluation
			// time (singletons constructed at module scope). The real env is
			// created by bootstrap-assign-env during graph evaluation, so seed
			// a minimal URL-backed shim first; it is replaced by the real
			// environment moments later.
			js: BANNER,
		},
	});
	console.log(`bundled ${entry.out}.js`);
}
