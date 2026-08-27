import { vi } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, "..");

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
	getLoadSettings: vi.fn(() => ({ windowType: 'root' })),
	loadTime: 0,
	keymaps: {
		add: vi.fn(),
		onDidLoad: vi.fn(() => ({ dispose: () => {} })),
	},
	loadSettings: {},
};
