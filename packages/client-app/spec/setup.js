import { vi } from "vitest";
import { registerHooks } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, "..");

// The vitest aliases only cover imports vite transforms. Source files also
// reach the app-internal module names (and electron) through native
// require/createRequire and require(esm) chains, which Node resolves itself.
// Point those at the test bridges here, in-process, instead of symlinking
// the bridges into node_modules (which poisoned real installs).
const bridgeDir = path.join(__dirname, "stubs", "node-bridges");
const BRIDGES = {
	electron: "electron",
	"@electron/remote": "at-electron-remote",
	"@electron/remote/main": "at-electron-remote",
	"@electron/remote/renderer": "at-electron-remote",
	"nylas-exports": "nylas-exports",
	"nylas-component-kit": "nylas-component-kit",
	"nylas-store": "nylas-store",
	"nylas-observables": "nylas-observables",
};
registerHooks({
	resolve(specifier, context, nextResolve) {
		const bridge = Object.hasOwn(BRIDGES, specifier) && BRIDGES[specifier];
		if (bridge) {
			return {
				url: pathToFileURL(path.join(bridgeDir, bridge, "index.js")).href,
				shortCircuit: true,
			};
		}
		return nextResolve(specifier, context);
	},
});

globalThis.NylasEnv = {
	config: {
		get: vi.fn(() => false),
		set: vi.fn(),
		onDidChange: vi.fn(() => ({ dispose: vi.fn() })),
		observe: vi.fn((_path, cb) => {
			if (cb) cb(undefined);
			return { dispose: vi.fn() };
		}),
		unobserve: vi.fn(),
		toggle: vi.fn(),
	},
	getCurrentWindow: vi.fn(() => ({
		show() {},
		maximize() {},
		openDevTools() {},
	})),
	inBenchmarkMode: vi.fn(() => false),
	inDevMode: vi.fn(() => false),
	inSpecMode: vi.fn(() => true),
	reportError: vi.fn(),
	getConfigDirPath: vi.fn(() => "/tmp/nylas-spec"),
	getResourcePath: vi.fn(() => packageRoot),
	packages: { pluginIdFor: vi.fn(() => null) },
	menu: { add: vi.fn(() => ({ dispose: vi.fn() })), remove: vi.fn() },
	fileListCache: vi.fn(() => ({ read: vi.fn(() => ({})) })),
	commands: {
		add: vi.fn(() => ({ dispose: vi.fn() })),
		dispatch: vi.fn(),
	},
	isWorkWindow: vi.fn(() => false),
	onBeforeUnload: vi.fn(),
	on: vi.fn(() => ({ dispose: () => {} })),
	off: vi.fn(),
	emit: vi.fn(),
	store: () => ({ get: () => ({}), set: () => {}, onDidChange: () => ({ dispose: () => {} }) }),
	isMainWindow: vi.fn(() => true),
	getWindowType: vi.fn(() => 'root'),
	getLoadSettings: vi.fn(() => ({ windowType: 'root', resourcePath: packageRoot })),
	loadTime: 0,
	keymaps: {
		add: vi.fn(),
		onDidLoad: vi.fn(() => ({ dispose: () => {} })),
	},
	loadSettings: {},
};

// Bluebird-ism still present in original package code (unread-notifications,
// snooze-utils, thread-search). Minimal polyfill for tests.
if (!Promise.props) {
	Promise.props = function props(object) {
		const keys = Object.keys(object);
		return Promise.all(keys.map((key) => Promise.resolve(object[key]))).then((values) => {
			const result = {};
			keys.forEach((key, i) => { result[key] = values[i]; });
			return result;
		});
	};
}
