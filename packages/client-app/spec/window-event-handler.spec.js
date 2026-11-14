import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => {
	const ipcHandlers = {};
	const commands = {};
	const webContents = {
		copy: vi.fn(), cut: vi.fn(), paste: vi.fn(), pasteAndMatchStyle: vi.fn(),
		undo: vi.fn(), redo: vi.fn(), selectAll: vi.fn(),
	};
	const application = { isQuitting: vi.fn(() => false), openUrl: vi.fn() };
	const remote = {
		app: { quit: vi.fn() }, getGlobal: vi.fn(() => application),
		getCurrentWindow: vi.fn(() => ({ webContents })),
	};
	return {
		ipcHandlers, commands, webContents, application, remote,
		openExternal: vi.fn(), dispatch: vi.fn(), add: vi.fn((_el, name, fn) => { commands[name] = fn; }),
		storeDimensions: vi.fn(), saveAndUnload: vi.fn(), close: vi.fn(), reload: vi.fn(),
		toggleFullScreen: vi.fn(), toggleDevTools: vi.fn(), openLogs: vi.fn(),
	};
});

vi.mock("node:path", () => ({ default: { join: (...parts) => parts.join("/") }, join: (...parts) => parts.join("/") }));
vi.mock("node:url", () => {
	const parse = (href) => ({ protocol: /^[a-z]+:/i.exec(href)?.[0]?.toLowerCase() });
	return { default: { parse }, parse };
});
vi.mock("underscore", () => {
	const underscore = { defer: (fn) => fn() };
	return { default: underscore, ...underscore };
});
vi.mock("event-kit", () => ({
	default: { Disposable: class Disposable {} }, Disposable: class Disposable {},
}));
vi.mock("fs-plus", () => ({ default: {}, existsSync: vi.fn(), readFileSync: vi.fn() }));
vi.mock("electron", () => {
	const electron = {
		shell: { openExternal: m.openExternal },
		ipcRenderer: { on: (name, fn) => { m.ipcHandlers[name] = fn; } },
		remote: m.remote,
	};
	return { default: electron, ...electron };
});
vi.mock("@electron/remote", () => ({ default: m.remote, ...m.remote, remote: m.remote }));
vi.mock("../src/registries/component-registry.js", () => ({ default: { toggleComponentRegions: vi.fn() } }));
vi.mock("../src/spellchecker.js", () => ({ default: { appendSpellingItemsToMenu: vi.fn() } }));

globalThis.NylasEnv = {
	commands: { add: m.add, dispatch: m.dispatch },
	inSpecMode: vi.fn(() => false), isMainWindow: vi.fn(() => false), inDevMode: vi.fn(() => false),
	storeWindowDimensions: m.storeDimensions, saveStateAndUnloadWindow: m.saveAndUnload,
	close: m.close, reload: m.reload, toggleFullScreen: m.toggleFullScreen,
	toggleDevTools: m.toggleDevTools, errorLogger: { openLogs: m.openLogs },
	getCurrentWindow: () => ({ webContents: m.webContents }), isReloading: false,
};

const { default: WindowEventHandler } = await import("../src/window-event-handler.js");

describe("WindowEventHandler window dispatch", () => {
	let handler;
	beforeEach(() => {
		vi.clearAllMocks();
		document.body.className = "";
		Object.keys(m.commands).forEach((key) => delete m.commands[key]);
		Object.keys(m.ipcHandlers).forEach((key) => delete m.ipcHandlers[key]);
		NylasEnv.inSpecMode.mockReturnValue(false);
		NylasEnv.isReloading = false;
		m.application.isQuitting.mockReturnValue(false);
		handler = new WindowEventHandler();
	});

	it("routes the close command to the environment", () => {
		m.commands["window:close"](); expect(m.close).toHaveBeenCalledOnce();
	});
	it("routes the full-screen command to the environment", () => {
		m.commands["window:toggle-full-screen"](); expect(m.toggleFullScreen).toHaveBeenCalledOnce();
	});
	it("routes copy to the current web contents", () => {
		m.commands["core:copy"](); expect(m.webContents.copy).toHaveBeenCalledOnce();
	});
	it("routes paste-and-match-style to the current web contents", () => {
		m.commands["core:paste-and-match-style"](); expect(m.webContents.pasteAndMatchStyle).toHaveBeenCalledOnce();
	});
	it("prevents drops from navigating the window", () => {
		const event = { preventDefault: vi.fn(), stopPropagation: vi.fn() }; handler.onDrop(event);
		expect(event.preventDefault).toHaveBeenCalledOnce();
	});
	it("stops drop propagation", () => {
		const event = { preventDefault: vi.fn(), stopPropagation: vi.fn() }; handler.onDrop(event);
		expect(event.stopPropagation).toHaveBeenCalledOnce();
	});
	it("resolves the href from the closest linked ancestor", () => {
		const link = document.createElement("a"); link.href = "https://example.com/path";
		const child = document.createElement("span"); link.appendChild(child);
		expect(handler.resolveHref(child)).toBe("https://example.com/path");
	});
	it("ignores relative links", () => {
		handler.openLink({ href: "/inbox" }); expect(m.openExternal).not.toHaveBeenCalled();
	});
});

describe("WindowEventHandler unload lifecycle", () => {
	let handler;
	beforeEach(() => {
		vi.clearAllMocks(); NylasEnv.inSpecMode.mockReturnValue(false); NylasEnv.isReloading = false;
		m.application.isQuitting.mockReturnValue(false); handler = new WindowEventHandler();
	});

	it("adds unload callbacks", () => {
		const callback = vi.fn(() => true); handler.addUnloadCallback(callback);
		expect(handler.unloadCallbacks).toContain(callback);
	});
	it("removes unload callbacks", () => {
		const callback = vi.fn(() => true); handler.addUnloadCallback(callback); handler.removeUnloadCallback(callback);
		expect(handler.unloadCallbacks).not.toContain(callback);
	});
	it("allows unload when every callback completes synchronously", () => {
		handler.addUnloadCallback(() => true); expect(handler.runUnloadCallbacks()).toBe(true);
	});
	it("blocks unload while an asynchronous callback is pending", () => {
		handler.addUnloadCallback(() => false); expect(handler.runUnloadCallbacks()).toBe(false);
	});
	it("stores dimensions before an allowed unload", () => {
		handler.addUnloadCallback(() => true); window.onbeforeunload();
		expect(m.storeDimensions).toHaveBeenCalledOnce();
	});
	it("saves state before an allowed unload", () => {
		handler.addUnloadCallback(() => true); window.onbeforeunload();
		expect(m.saveAndUnload).toHaveBeenCalledOnce();
	});
	it("skips unload work in spec mode", () => {
		NylasEnv.inSpecMode.mockReturnValue(true); expect(window.onbeforeunload()).toBeUndefined();
		expect(m.storeDimensions).not.toHaveBeenCalled();
	});
	it("finishes a delayed unload after its completion callback runs", () => {
		const finished = vi.spyOn(handler, "runUnloadFinished").mockImplementation(() => {}); let complete;
		handler.addUnloadCallback((done) => { complete = done; return false; });
		handler.runUnloadCallbacks(); complete(); expect(finished).toHaveBeenCalledOnce();
	});
});
