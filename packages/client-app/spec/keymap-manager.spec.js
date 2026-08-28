import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
	files: new Map(), watchers: new Map(), bound: new Map(), sends: vi.fn(), dispatch: vi.fn(),
	writeFile: vi.fn(), observe: vi.fn(), menuUpdate: vi.fn(), menuSend: vi.fn(),
}));

vi.mock("fs-plus", () => {
	const fs = {
		readFileSync: vi.fn((path) => { if (!m.files.has(path)) { const error = new Error("missing"); error.code = "ENOENT"; throw error; } return m.files.get(path); }),
		existsSync: vi.fn((path) => m.files.has(path)), writeFileSync: m.writeFile,
		watch: vi.fn((path, fn) => m.watchers.set(path, fn)),
	};
	return { default: fs, ...fs };
});
vi.mock("node:path", () => {
	const path = { join: (...parts) => parts.join("/") };
	return { default: path, ...path };
});
vi.mock("mousetrap", () => {
	class Mousetrap {}
	Mousetrap.prototype.bind = vi.fn((keys, fn) => m.bound.set(keys, fn));
	const instance = new Mousetrap();
	instance.prototype = Mousetrap.prototype;
	instance.bind = Mousetrap.prototype.bind;
	return { default: instance, ...instance };
});
vi.mock("electron", () => {
	const electron = { ipcRenderer: { send: m.sends }, shell: {}, remote: {} };
	return { default: electron, ...electron };
});
vi.mock("@electron/remote", () => ({ default: {}, remote: {}, ipcRenderer: { send: m.sends }, shell: {} }));
vi.mock("event-kit", () => {
	class Disposable { constructor(fn) { this.fn = fn; } dispose() { this.fn?.(); } }
	class Emitter {
		constructor() { this.handlers = new Map(); }
		on(name, fn) { this.handlers.set(name, fn); return new Disposable(() => this.handlers.delete(name)); }
		emit(name, value) { this.handlers.get(name)?.(value); }
	}
	return { default: { Emitter, Disposable }, Emitter, Disposable };
});

globalThis.NylasEnv = {
	commands: { dispatch: m.dispatch },
	menu: { template: { File: [] }, update: m.menuUpdate, sendToBrowserProcess: m.menuSend },
	config: { observe: m.observe, get: vi.fn() },
};

const { default: KeymapManager } = await import("../src/keymap-manager.js");

const makeManager = () => new KeymapManager({ configDirPath: "/config", resourcePath: "/resources" });

describe("KeymapManager loading and merging", () => {
	beforeEach(() => {
		vi.clearAllMocks(); m.files.clear(); m.watchers.clear(); m.bound.clear();
		NylasEnv.config.get.mockReturnValue(undefined);
	});

	it("builds the user keymap path from the config directory", () => {
		expect(makeManager().getUserKeymapPath()).toBe("/config/keymap.json");
	});
	it("removes a keymap when its disposable is disposed", () => {
		m.files.set("/one.json", JSON.stringify({ "message:archive": "a" }));
		const manager = makeManager(); const disposable = manager.loadKeymap("/one.json"); disposable.dispose();
		expect(manager.getBindingsForCommand("message:archive")).toEqual([]);
	});
	it("notifies reload subscribers after a cache rebuild", () => {
		const manager = makeManager(); const listener = vi.fn(); manager.onDidReloadKeymap(listener);
		manager.keymapCacheInvalidated(); expect(listener).toHaveBeenCalledOnce();
	});
});

describe("KeymapManager binding and lifecycle", () => {
	beforeEach(() => {
		vi.clearAllMocks(); m.files.clear(); m.watchers.clear(); m.bound.clear();
		NylasEnv.config.get.mockReturnValue(undefined);
	});

	it("loads the selected template keymap", () => {
		NylasEnv.config.get.mockReturnValue("Gmail"); const manager = makeManager(); const load = vi.spyOn(manager, "loadKeymap");
		manager.loadTemplateKeymap(); expect(load).toHaveBeenCalledWith("/resources/keymaps/templates/Gmail.json");
	});
	it("maps the legacy GoogleInbox template name", () => {
		NylasEnv.config.get.mockReturnValue("GoogleInbox"); const manager = makeManager(); const load = vi.spyOn(manager, "loadKeymap");
		manager.loadTemplateKeymap(); expect(load).toHaveBeenCalledWith("/resources/keymaps/templates/Inbox by Gmail.json");
	});
	it("sends an empty keymap to the browser process while suspended", () => {
		makeManager().suspendAllKeymaps();
		expect(m.menuSend).toHaveBeenCalledWith(NylasEnv.menu.template, {});
	});
	it("updates the menu when keymaps resume", () => {
		makeManager().resumeAllKeymaps(); expect(m.menuUpdate).toHaveBeenCalledOnce();
	});
});
