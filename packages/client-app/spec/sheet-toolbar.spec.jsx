import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => {
	const locations = {
		globalLeft: { id: "global:left" }, globalRight: { id: "global:right" },
		mailLeft: { id: "mail:left" }, mailRight: { id: "mail:right" },
	};
	return {
		locations, register: vi.fn(), registryListen: vi.fn(), workspaceListen: vi.fn(),
		find: vi.fn(() => []), layoutMode: vi.fn(() => "list"), hidden: vi.fn(() => false),
		popSheet: vi.fn(), setSheetOffset: vi.fn(), menuPopup: vi.fn(),
		close: vi.fn(), minimize: vi.fn(), maximize: vi.fn(), setFullScreen: vi.fn(),
		isFullScreen: vi.fn(() => false), currentWindow: vi.fn(() => ({ native: true })),
		setMinimumWidth: vi.fn(), storeColumnWidth: vi.fn(), getColumnWidth: vi.fn(),
		isEqualReact: vi.fn((a, b) => a === b), isEqual: vi.fn((a, b) => a === b),
	};
});

vi.mock("node:module", () => { const createRequire = () => vi.fn(() => () => ({})); return { default: { createRequire }, createRequire }; });
vi.mock("prop-types", () => ({ default: new Proxy({}, { get: () => Object.assign(() => null, { isRequired: null }) }) }));
vi.mock("react", () => {
	class Component {
		constructor(props) { this.props = props || {}; this.state = this.state || {}; }
		setState(next) { this.state = { ...this.state, ...(typeof next === "function" ? next(this.state, this.props) : next) }; }
	}
	const createElement = (type, props, ...children) => ({ type, props: { ...(props || {}), children } });
	const createContext = (value) => ({ Provider: "Provider", _currentValue: value });
	const createRef = () => ({ current: null });
	const react = { Component, createElement, createContext, createRef };
	return { default: react, ...react };
});
vi.mock("underscore", () => {
	const underscore = { isEqual: m.isEqual, reduce: (items, fn, initial) => items.reduce(fn, initial) };
	return { default: underscore, ...underscore };
});
vi.mock("underscore.string", () => ({ default: { titleize: (value) => value.replace(/\b\w/g, (c) => c.toUpperCase()) }, titleize: (value) => value.replace(/\b\w/g, (c) => c.toUpperCase()) }));
vi.mock("electron", () => {
	const remote = {
		app: { quit: vi.fn(), getVersion: () => "0.0.0", getPath: () => "/tmp" },
		screen: { getPrimaryDisplay: () => ({ workArea: { width: 1440, height: 900 } }) },
		dialog: { showMessageBox: vi.fn() }, getCurrentWindow: () => ({ setSheetOffset: m.setSheetOffset }),
		getGlobal: () => ({ applicationMenu: { menu: { popup: m.menuPopup } } }),
	};
	const ipcRenderer = { send: vi.fn() }; const shell = {};
	return { default: { remote, ipcRenderer, shell }, remote, ipcRenderer, shell };
});
vi.mock("@electron/remote", () => {
	const app = { quit: vi.fn(), getVersion: () => "0.0.0", getPath: () => "/tmp" };
	const screen = { getPrimaryDisplay: () => ({ workArea: { width: 1440, height: 900 } }) };
	const dialog = { showMessageBox: vi.fn() }; const ipcRenderer = { send: vi.fn() }; const shell = {};
	const remote = { app, screen, dialog, shell, getCurrentWindow: () => ({ setSheetOffset: m.setSheetOffset }) };
	return { default: remote, ...remote, remote, ipcRenderer };
});
vi.mock("nylas-exports", () => ({
	default: {}, Actions: { popSheet: m.popSheet },
	ComponentRegistry: { register: m.register, listen: m.registryListen, findComponentsMatching: m.find },
	WorkspaceStore: {
		layoutMode: m.layoutMode, listen: m.workspaceListen, isLocationHidden: m.hidden,
		Sheet: { Global: { Toolbar: { Left: m.locations.globalLeft, Right: m.locations.globalRight } } },
	},
}));
vi.mock("../src/components/flexbox.jsx", () => ({ default: function Flexbox() {} }));
vi.mock("../src/components/retina-img.jsx", () => ({ default: Object.assign(function RetinaImg() {}, { Mode: { ContentIsMask: "mask" } }) }));
vi.mock("../src/flux/models/utils.js", () => ({ default: { isEqualReact: m.isEqualReact }, isEqualReact: m.isEqualReact }));
vi.mock("../src/sheet.jsx", () => ({ default: function MockSheet() {} }));
vi.mock("../src/flux/models/category.js", () => ({ default: { AllMailName: "all" } }));
vi.mock("../src/flux/stores/focused-perspective-store.js", () => ({ default: { current: () => ({ name: "inbox" }), listen: vi.fn() } }));
vi.mock("../src/components/injected-component-set.jsx", () => ({ default: function InjectedComponentSet() {}, __esModule: true }));
vi.mock("../src/components/resizable-region.jsx", () => {
	const Handle = { Left: "left", Right: "right" };
	return { default: Object.assign(function ResizableRegion() {}, { Handle }), Handle, __esModule: true };
});

globalThis.NylasEnv = {
	close: m.close, minimize: m.minimize, maximize: m.maximize,
	setFullScreen: m.setFullScreen, isFullScreen: m.isFullScreen,
	getCurrentWindow: m.currentWindow, setMinimumWidth: m.setMinimumWidth,
	storeColumnWidth: m.storeColumnWidth, getColumnWidth: m.getColumnWidth,
	getLoadSettings: vi.fn(() => ({ title: "Compose" })), onWindowPropsReceived: vi.fn(),
};

import Toolbar from "../src/sheet-toolbar.jsx";
import Sheet from "../src/sheet.jsx";

afterEach(() => vi.restoreAllMocks());

const region = (id) => ({ id, Toolbar: { id: `${id}:toolbar`, Left: { id: `${id}:left` }, Right: { id: `${id}:right` } } });
const data = (columns = [region("mail"), region("detail")]) => ({
	id: "sheet-7", columns: { list: columns }, Toolbar: { Left: m.locations.mailLeft, Right: m.locations.mailRight },
});
const makeToolbar = (overrides = {}) => {
	// The decaffeinated constructor touches `this` before `super()`, so exercise the
	// real prototype methods without invoking that invalid legacy constructor.
	const toolbar = Object.create(Toolbar.prototype);
	toolbar.props = { data: data(), depth: 0, ...overrides };
	toolbar._containerRef = { current: null };
	toolbar.state = toolbar._getStateFromStores();
	toolbar.setState = vi.fn((next) => { toolbar.state = { ...toolbar.state, ...next }; });
	return toolbar;
};

describe("SheetToolbar store composition", () => {
	beforeEach(() => { vi.clearAllMocks(); m.layoutMode.mockReturnValue("list"); m.hidden.mockReturnValue(false); m.find.mockReturnValue([]); });

	it("adds global-right and sheet-right entries to the last column", () => {
		function GlobalRight() {} function SheetRight() {}
		m.find.mockImplementation(({ location }) => location === m.locations.globalRight ? [GlobalRight] : location === m.locations.mailRight ? [SheetRight] : []);
		expect(makeToolbar().state.columns[1]).toEqual([GlobalRight, SheetRight]);
	});
	it("adds a back control to nested sheets", () => { const toolbar = makeToolbar({ depth: 1 }); expect(toolbar.state.columns[0].at(-1).displayName).toBe("ToolbarBack"); });
	it("does not add a back control to the root sheet", () => { expect(makeToolbar().state.columns[0].some((x) => x.displayName === "ToolbarBack")).toBe(false); });
	it("adds the window title in popout mode", () => { m.layoutMode.mockReturnValue("popout"); const popoutData = data(); popoutData.columns.popout = popoutData.columns.list; expect(makeToolbar({ data: popoutData }).state.columns[0].at(-1).displayName).toBe("WindowTitle"); });
	it("renders the sheet id and mode on the container", () => { const provider = makeToolbar().render(); expect(provider.props.value).toEqual({ sheetDepth: 0 }); const node = provider.props.children[0]; expect(node.props["data-id"]).toBe("sheet-7"); expect(node.props.className).toBe("sheet-toolbar-container mode-list"); });
	it("renders column toolbars hidden until layout is measured", () => { const child = makeToolbar().render().props.children[0].props.children[0][0]; expect(child.props.style.display).toBe("none"); });
	it("passes toolbar props through to registered components", () => { function Item() {} Item.displayName = "Item"; const toolbar = makeToolbar(); toolbar.props.marker = 9; const item = toolbar._flexboxForComponents([Item]).props.children[0][0]; expect(item.props.marker).toBe(9); });
	it("places spacer elements on opposite sides of the center order", () => { const children = makeToolbar()._flexboxForComponents([]).props.children; expect(children.slice(1).map((x) => x.props.order)).toEqual([-50, 50]); });
	it("provides its sheet depth through SheetDepthContext", () => { expect(makeToolbar({ depth: 3 })._sheetDepthContext()).toEqual({ sheetDepth: 3 }); });
	it("keeps the context value stable for an unchanged depth", () => { const toolbar = makeToolbar({ depth: 2 }); expect(toolbar._sheetDepthContext()).toBe(toolbar._sheetDepthContext()); });
});

describe("SheetToolbar layout and lifecycle", () => {
	beforeEach(() => { vi.clearAllMocks(); m.layoutMode.mockReturnValue("list"); m.find.mockReturnValue([]); });
	it("does not lay out an unmounted toolbar", () => { const toolbar = makeToolbar(); const el = document.createElement("div"); const query = vi.spyOn(el, "querySelectorAll"); toolbar._containerRef.current = el; toolbar.recomputeLayout(); expect(query).not.toHaveBeenCalled(); });
	it("skips layout before its container node is attached", () => { const toolbar = makeToolbar(); toolbar.mounted = true; toolbar.recomputeLayout(); expect(m.setSheetOffset).not.toHaveBeenCalled(); });
	it("reports the rendered toolbar height to the native window", () => { const el = document.createElement("div"); Object.defineProperty(el, "clientHeight", { value: 44 }); vi.spyOn(document, "querySelectorAll").mockReturnValue([document.createElement("div")]); const toolbar = makeToolbar(); toolbar._containerRef.current = el; toolbar.mounted = true; toolbar.recomputeLayout(); expect(m.setSheetOffset).toHaveBeenCalledWith(44); });
	it("skips offset reporting when its sheet depth is absent", () => { vi.spyOn(document, "querySelectorAll").mockReturnValue([]); const toolbar = makeToolbar(); toolbar._containerRef.current = document.createElement("div"); toolbar.mounted = true; toolbar.recomputeLayout(); expect(m.setSheetOffset).not.toHaveBeenCalled(); });
	it("subscribes to workspace and component registry changes", () => { const toolbar = makeToolbar(); vi.spyOn(window, "requestAnimationFrame").mockImplementation((fn) => { fn(); return 1; }); toolbar.recomputeLayout = vi.fn(); toolbar.componentDidMount(); expect([m.workspaceListen.mock.calls.length, m.registryListen.mock.calls.length]).toEqual([1, 1]); });
	it("removes resize listeners and disposes subscriptions", () => { const a = vi.fn(); const b = vi.fn(); const toolbar = makeToolbar(); toolbar.unlisteners = [a, b]; toolbar.componentWillUnmount(); expect(a).toHaveBeenCalledOnce(); expect(b).toHaveBeenCalledOnce(); expect(toolbar.mounted).toBe(false); });
	it("recomputes layout on window resize", () => { const toolbar = makeToolbar(); toolbar.recomputeLayout = vi.fn(); toolbar._onWindowResize(); expect(toolbar.recomputeLayout).toHaveBeenCalledOnce(); });
	it("avoids updates when props and state are React-equal", () => { const toolbar = makeToolbar(); m.isEqualReact.mockReturnValue(true); expect(toolbar.shouldComponentUpdate(toolbar.props, toolbar.state)).toBe(false); });
});


