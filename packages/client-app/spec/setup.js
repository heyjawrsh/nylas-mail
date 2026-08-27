import { vi } from "vitest";

globalThis.NylasEnv = {
	config: {
		get: vi.fn(() => false),
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
};
