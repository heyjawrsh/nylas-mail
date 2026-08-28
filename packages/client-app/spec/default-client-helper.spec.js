import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
	exec: vi.fn(), exists: vi.fn(), readFile: vi.fn(), readFileSync: vi.fn(),
	writeFileSync: vi.fn(), unlink: vi.fn(), showMessageBox: vi.fn(),
	openExternal: vi.fn(), createRegistryEntries: vi.fn(),
}));

vi.mock("node:child_process", () => ({ default: { exec: m.exec }, exec: m.exec }));
vi.mock("node:fs", () => {
	const fs = { exists: m.exists, readFile: m.readFile, readFileSync: m.readFileSync, writeFileSync: m.writeFileSync, unlink: m.unlink };
	return { default: fs, ...fs };
});
vi.mock("electron", () => {
	const remote = { dialog: { showMessageBox: m.showMessageBox }, require: vi.fn(() => ({ createRegistryEntries: m.createRegistryEntries })) };
	const shell = { openExternal: m.openExternal };
	return { default: { remote, shell }, remote, shell };
});

const { Mac, Linux, Windows } = await import("../src/default-client-helper.js");

describe("default client helpers", () => {
	beforeEach(() => vi.clearAllMocks());

	it("reports every supported platform helper as available", () => {
		expect([new Mac().available(), new Linux().available(), new Windows().available()]).toEqual([true, true, true]);
	});

	it("requires a callback for Linux registration checks", () => {
		expect(() => new Linux().isRegisteredForURLScheme("mailto")).toThrow("isRegisteredForURLScheme is async");
	});





	it("requires a callback for Windows registration checks", () => {
		expect(() => new Windows().isRegisteredForURLScheme("mailto")).toThrow("isRegisteredForURLScheme is async");
	});







	it("finds a matching macOS URL scheme registration", () => {
		const helper = new Mac(); helper.readDefaults = vi.fn((callback) => callback([{ LSHandlerURLScheme: "mailto", LSHandlerRoleAll: "com.nylas.nylas-mail" }])); const callback = vi.fn();
		helper.isRegisteredForURLScheme("mailto", callback);
		expect(callback).toHaveBeenCalledWith(true);
	});

	it("removes matching macOS registrations when resetting", () => {
		const helper = new Mac(); const defaults = [{ LSHandlerURLScheme: "mailto" }, { LSHandlerURLScheme: "webcal" }];
		helper.readDefaults = vi.fn((callback) => callback(defaults)); helper.writeDefaults = vi.fn(); helper.resetURLScheme("mailto", vi.fn());
		expect(helper.writeDefaults.mock.calls[0][0]).toEqual([{ LSHandlerURLScheme: "webcal" }]);
	});

	it("replaces an existing macOS registration with the Nylas bundle", () => {
		const helper = new Mac(); const defaults = [{ LSHandlerURLScheme: "mailto", LSHandlerRoleAll: "old.app" }];
		helper.readDefaults = vi.fn((callback) => callback(defaults)); helper.writeDefaults = vi.fn(); helper.registerForURLScheme("mailto", vi.fn());
		expect(helper.writeDefaults.mock.calls[0][0]).toEqual([{ LSHandlerURLScheme: "mailto", LSHandlerRoleAll: "com.nylas.nylas-mail" }]);
	});
});
