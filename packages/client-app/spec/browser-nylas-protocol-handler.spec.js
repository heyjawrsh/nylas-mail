import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	getPath: vi.fn(() => "/home/alice"),
	registerFileProtocol: vi.fn(),
	statSyncNoException: vi.fn(() => ({})),
}));

vi.mock("electron", () => ({
	app: { getPath: mocks.getPath },
	protocol: { registerFileProtocol: mocks.registerFileProtocol },
}));
vi.mock("fs-plus", () => ({
	default: { statSyncNoException: mocks.statSyncNoException },
}));

import NylasProtocolHandler from "../src/browser/nylas-protocol-handler.js";

const registeredHandler = () => mocks.registerFileProtocol.mock.calls[0][1];

describe("NylasProtocolHandler", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.getPath.mockReturnValue("/home/alice");
		mocks.statSyncNoException.mockReturnValue({});
	});

	it("registers the nylas file protocol", () => {
		new NylasProtocolHandler("/resources", false);
		expect(mocks.registerFileProtocol).toHaveBeenCalledWith("nylas", expect.any(Function));
	});

	it("includes development packages outside safe mode", () => {
		const handler = new NylasProtocolHandler("/resources", false);
		expect(handler.loadPaths).toEqual([
			"/home/alice/.nylas-mail/dev/packages",
			"/home/alice/.nylas-mail/packages",
			"/resources/internal_packages",
		]);
	});

	it("omits development packages in safe mode", () => {
		const handler = new NylasProtocolHandler("/resources", true);
		expect(handler.loadPaths).toEqual([
			"/home/alice/.nylas-mail/packages",
			"/resources/internal_packages",
		]);
	});

	it("resolves an existing user asset directly", () => {
		mocks.statSyncNoException.mockImplementation((filePath) => ({
			isFile: () => filePath === "/home/alice/.nylas-mail/assets/icon.png",
		}));
		new NylasProtocolHandler("/resources", false);
		const callback = vi.fn();
		registeredHandler()({ url: "nylas:/assets/icon.png" }, callback);
		expect(callback).toHaveBeenCalledWith("/home/alice/.nylas-mail/assets/icon.png");
	});

	it("searches package load paths in order", () => {
		mocks.statSyncNoException.mockImplementation((filePath) => ({
			isFile: () => filePath === "/home/alice/.nylas-mail/packages/pkg/main.js",
		}));
		new NylasProtocolHandler("/resources", false);
		const callback = vi.fn();
		registeredHandler()({ url: "nylas:/pkg/main.js" }, callback);
		expect(mocks.statSyncNoException.mock.calls.map(([p]) => p)).toEqual([
			"/home/alice/.nylas-mail/dev/packages/pkg/main.js",
			"/home/alice/.nylas-mail/packages/pkg/main.js",
		]);
		expect(callback).toHaveBeenCalledWith("/home/alice/.nylas-mail/packages/pkg/main.js");
	});

	it("returns the last attempted path when no file exists", () => {
		// This is the current behavior: filePath is not reset after failed probes.
		new NylasProtocolHandler("/resources", true);
		const callback = vi.fn();
		registeredHandler()({ url: "nylas:/unknown.txt" }, callback);
		expect(callback).toHaveBeenCalledWith("/resources/internal_packages/unknown.txt");
	});
});
