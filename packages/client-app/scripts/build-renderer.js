// Bundles the renderer bootstrap graphs (mixed CJS/ESM sources) into classic
// scripts the Electron renderer can execute without a module loader. The 2017
// app did this at runtime via compile-cache (babel/coffee JIT); the modernized
// codebase does it once, ahead of launch, with esbuild.
import { build } from "esbuild";
import { realpathSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

export const BANNER = `
(function () {
	if (typeof window === "undefined" || window.NylasEnv) return;
	// Bluebird-ism used across task/model code (Promise.props).
	if (typeof Promise.props !== "function") {
		Promise.props = function (object) {
			var keys = Object.keys(object);
			return Promise.all(keys.map(function (k) { return Promise.resolve(object[k]); })).then(function (values) {
				var result = {};
				keys.forEach(function (k, i) { result[k] = values[i]; });
				return result;
			});
		};
	}
	var qs = {};
	try {
		var params = new URLSearchParams(window.location.search);
		params.forEach(function (v, k) { qs[k] = v; });
		// The app passes its full settings blob as ?loadSettings=<json>
		var raw = params.get("loadSettings");
		if (raw) {
			try { qs = Object.assign(JSON.parse(raw), qs); } catch (e) {}
		}
	} catch (e) {}
	// Config subscriptions made before the real environment exists (stores
	// built at module scope, like AccountStore). The real NylasEnv replays
	// them onto its config before loading it, so they see the load.
	var early = (window.__nylasEarlyConfigSubscriptions = []);
	var subscribe = function (method, args) {
		var record = { method: method, args: args, disposed: false, real: null };
		early.push(record);
		return {
			dispose: function () {
				record.disposed = true;
				if (record.real) record.real.dispose();
			},
		};
	};
	// The saved settings, read once from the main process the way the real
	// Config reads them, so stores built now (AccountStore loads the accounts
	// in its constructor) see the real values. No schema defaults yet.
	var settings = null;
	var readSetting = function (keyPath) {
		if (settings === null) {
			try {
				settings = JSON.parse(
					require("@electron/remote")
						.getGlobal("application")
						.configPersistenceManager.getRawValuesString(),
				);
			} catch (e) {
				settings = {};
			}
		}
		if (!keyPath) return settings;
		var value = settings;
		var keys = String(keyPath).split(".");
		for (var i = 0; i < keys.length; i++) {
			if (value == null || typeof value !== "object") return null;
			value = value[keys[i]];
		}
		return value === undefined ? null : JSON.parse(JSON.stringify(value));
	};
	window.NylasEnv = {
		loadSettings: qs,
		inSpecMode: function () { return qs.specMode === "1" || qs.specMode === "true"; },
		isWorkWindow: function () { return qs.windowType === "work" || false; },
		// same answers as the real NylasEnv (stores read these at load time)
		isMainWindow: function () { return !!qs.mainWindow; },
		isEmptyWindow: function () { return qs.windowType === "emptyWindow"; },
		getWindowType: function () { return qs.windowType || "root"; },
		getLoadSettings: function () { return qs; },
		inDevMode: function () { return qs.devMode === "1" || qs.devMode === "true"; },
		inBenchmarkMode: function () { return false; },
		getConfigDirPath: function () { return qs.configDirPath || ""; },
		getResourcePath: function () { return qs.resourcePath || ""; },
		reportError: function () {},
		getCurrentWindow: function () {
			return { setSheetOffset: function () {}, close: function () {}, focus: function () {} };
		},
		onBeforeUnload: function () {},
		on: function () { return { dispose: function () {} }; },
		off: function () {},
		emit: function () {},
		errorLogger: { reportError: function () {} },
		config: {
			get: readSetting,
			set: function () {},
			onDidChange: function () { return subscribe("onDidChange", Array.prototype.slice.call(arguments)); },
			observe: function (path, cb) {
				if (cb) cb(undefined);
				return subscribe("observe", [path, cb]);
			},
			unobserve: function () {},
			toggle: function () {},
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

// Dual-context sources reach their neighbours through `nodeRequire("./x")`
// (createRequire under Node, the module's own require in the bundle). esbuild
// only follows literal `require(...)`, so in the bundle those calls would load
// a second, unbundled copy of the module from src/ (and fail outright for
// paths relative to static/). Rewrite relative ones so they are bundled.
// The formatter may leave a trailing comma after a wrapped argument.
export const RELATIVE_NODE_REQUIRE =
	/\bnodeRequire(\(\s*(["'`])\.{1,2}\/(?:(?!\2).)*\2\s*,?\s*\))/g;
const bundleRelativeNodeRequires = {
	name: "bundle-relative-node-requires",
	setup(pluginBuild) {
		pluginBuild.onLoad({ filter: /\.jsx?$/ }, async (args) => {
			if (args.path.includes(`${path.sep}node_modules${path.sep}`)) return;
			const source = await fs.readFile(args.path, "utf8");
			if (!source.includes("nodeRequire(")) return;
			return {
				// test helpers stay out of the bundle
				contents: source.replace(RELATIVE_NODE_REQUIRE, (call, args) =>
					args.includes("/spec/") ? call : `require${args}`,
				),
				loader: args.path.endsWith(".jsx") ? "jsx" : "js",
			};
		});
	},
};

// The bundle reaches the kit through a CommonJS shim, so esbuild can't tell
// whether `import { Name } from "nylas-component-kit"` names a real kit
// component. Check those imports against the names the kit registers.
const KIT_SOURCE = path.join(root, "src/global/nylas-component-kit.js");
const KIT_REGISTRATION =
	/NylasComponentKit\.(?:load|loadFrom|loadDeprecated|require|requireFrom)\(\s*"([\w$]+)"/g;
const KIT_NAMED_IMPORT =
	/\bimport\s+(?:[\w$]+\s*,\s*)?\{([^}]*)\}\s*from\s*["']nylas-component-kit["']/g;

export function kitRegisteredNames(source) {
	const names = new Set(["NylasComponentKit"]); // class handle set by the shim
	for (const [, name] of source.matchAll(KIT_REGISTRATION)) names.add(name);
	return names;
}

const lineAndColumn = (source, index) => {
	const before = source.slice(0, index);
	const line = before.split("\n").length;
	return { line, column: index - (before.lastIndexOf("\n") + 1) };
};

export const checkKitNamedImports = {
	name: "check-kit-named-imports",
	setup(pluginBuild) {
		let imports = [];
		pluginBuild.onStart(() => {
			imports = [];
		});
		pluginBuild.onLoad({ filter: /\.[cm]?jsx?$/ }, async (args) => {
			if (args.path.includes(`${path.sep}node_modules${path.sep}`)) return;
			const source = await fs.readFile(args.path, "utf8");
			if (!source.includes("nylas-component-kit")) return;
			for (const match of source.matchAll(KIT_NAMED_IMPORT)) {
				const listStart = match.index + match[0].indexOf("{") + 1;
				for (const spec of match[1].matchAll(/([\w$]+)(?:\s+as\s+[\w$]+)?/g)) {
					const { line, column } = lineAndColumn(
						source,
						listStart + spec.index,
					);
					imports.push({
						name: spec[1],
						file: path.relative(root, args.path),
						line,
						column,
						lineText: source.split("\n")[line - 1],
					});
				}
			}
			// no contents: the next plugin or esbuild loads the file
		});
		pluginBuild.onEnd(async () => {
			const known = kitRegisteredNames(await fs.readFile(KIT_SOURCE, "utf8"));
			const errors = imports
				.filter(({ name }) => !known.has(name))
				.map(({ name, ...location }) => ({
					text: `Import "${name}" from "nylas-component-kit" is not a registered kit name (see src/global/nylas-component-kit.js)`,
					location: { ...location, length: name.length },
				}));
			return { errors };
		});
	},
};

export const entries = [
	{
		in: path.join(root, "src/window-bootstrap.js"),
		out: "window-bootstrap.bundle",
	},
	{
		in: path.join(root, "src/secondary-window-bootstrap.js"),
		out: "secondary-window-bootstrap.bundle",
	},
];

// esbuild options for one entry. Exported so specs can build in memory.
export function buildOptions(entry) {
	return {
		entryPoints: [entry.in],
		bundle: true,
		format: "cjs",
		platform: "node",
		target: "chrome130",
		// same JSX runtime as the tests and the require-time compiler
		jsx: "automatic",
		// Models are keyed by class name (table names, registries); esbuild
		// renames colliding bindings (Event -> Event2) unless told not to.
		keepNames: true,
		define: { NYLAS_RENDERER_BUNDLE: "true" },
		outfile: path.join(root, "static", `${entry.out}.js`),
		// electron and @electron/remote must stay external — they only exist
		// inside the app runtime (the real remote module routes by process.type).
		// Native modules locate their binaries relative to their own package,
		// so they load from node_modules too.
		external: [
			"electron",
			"@electron/remote",
			"better-sqlite3",
			"sqlite3",
			"unix-dgram",
			"nslog",
			"bindings",
			"node-gyp-build",
			"pg-hstore",
			"*.node",
		],
		alias: {
			// native / optional modules: stubbed for the renderer bundle
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
			// bridges the old ModuleCache runtime resolution
			"nylas-exports": path.join(root, "src/global/nylas-exports.js"),
			// CJS shim so named imports are property reads at use time
			"nylas-component-kit": path.join(
				root,
				"src/global/nylas-component-kit-bundle.cjs",
			),
			"nylas-store": path.join(root, "src/global/nylas-store.js"),
			"nylas-observables": path.join(root, "src/global/nylas-observables.js"),
		},
		plugins: [checkKitNamedImports, bundleRelativeNodeRequires],
		logLevel: "warning",
		// An import its target doesn't export is undefined at runtime (every
		// kit component once was); fail the build instead.
		logOverride: { "import-is-undefined": "error" },
		banner: {
			// The flux layer reads the NylasEnv global at module-evaluation
			// time (singletons constructed at module scope). The real env is
			// created by bootstrap-assign-env during graph evaluation, so seed
			// a minimal URL-backed shim first; it is replaced by the real
			// environment moments later.
			js: BANNER,
		},
	};
}

// Build when run as a script, not when a spec imports the options.
if (
	process.argv[1] &&
	realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))
) {
	for (const entry of entries) {
		await build(buildOptions(entry));
		console.log(`bundled ${entry.out}.js`);
	}
}
