import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => {
	const registry = { listen: vi.fn(), findComponentsMatching: vi.fn(() => []), showComponentRegions: vi.fn(() => false) };
	const workspace = {
		listen: vi.fn(), layoutMode: vi.fn(() => "list"), sheetStack: vi.fn(() => []),
		isLocationHidden: vi.fn(() => false), Sheet: { Global: { Header: { id: "global-header" }, Footer: { id: "global-footer" } } },
	};
	const actions = { popSheet: vi.fn() };
	const utils = {
		isEqualReact: vi.fn((a, b) => a === b),
		fastOmit: (object, keys) => Object.fromEntries(Object.entries(object).filter(([key]) => !keys.includes(key))),
	};
	const remote = { Menu: class Menu { constructor() { this.items = []; } append(item) { this.items.push(item); } popup() {} }, MenuItem: class MenuItem { constructor(options) { Object.assign(this, options); } }, getCurrentWindow: vi.fn(() => "window") };
	return { registry, workspace, actions, utils, remote, findDOMNode: vi.fn(), render: vi.fn(), unmount: vi.fn() };
});

vi.mock("react", () => {
	class Component { constructor(props) { this.props = props || {}; this.state = this.state || {}; } setState(next) { this.state = { ...this.state, ...(typeof next === "function" ? next(this.state, this.props) : next) }; } }
	const createElement = (type, props, ...children) => ({ type, props: { ...(props || {}), children } });
	const createContext = (value) => ({ Provider: "Provider", _currentValue: value });
	const createRef = () => ({ current: null });
	const react = { Component, createElement, createContext, createRef };
	return { default: react, ...react };
});
vi.mock("prop-types", () => { const checker = Object.assign(() => null, { isRequired: null }); const types = new Proxy({ shape: () => checker }, { get: (target, key) => target[key] || checker }); return { default: types, ...types }; });
vi.mock("underscore", () => { const underscore = { isEqual: (a, b) => a === b, reduce: (items, fn, initial) => items.reduce(fn, initial), includes: (items, value) => items.includes(value) }; return { default: underscore, ...underscore }; });
vi.mock("classnames", () => { const classnames = (values) => Object.keys(values).filter((key) => values[key]).join(" "); return { default: classnames, classnames }; });
vi.mock("react-dom", () => { const dom = { findDOMNode: m.findDOMNode, render: m.render, unmountComponentAtNode: m.unmount }; return { default: dom, ...dom }; });
vi.mock("electron", () => { const electron = { remote: m.remote }; return { default: electron, ...electron, remote: m.remote }; });
vi.mock("@electron/remote", () => ({ default: m.remote, ...m.remote, remote: m.remote }));
vi.mock("nylas-exports", () => { const exports = { Actions: m.actions, ComponentRegistry: m.registry, WorkspaceStore: m.workspace, Utils: m.utils }; return { default: exports, ...exports }; });

const component = (name, extras = {}) => Object.assign(function MockComponent() {}, { displayName: name, ...extras });
vi.mock("../src/components/retina-img.jsx", () => ({ default: Object.assign(function RetinaImg() {}, { Mode: { ContentIsMask: "mask" } }) }));
vi.mock("../src/components/flexbox.jsx", () => ({ default: function Flexbox() {} }));
vi.mock("../src/components/resizable-region.jsx", () => { const ResizableRegion = Object.assign(function ResizableRegion() {}, { Handle: { Left: "left", Right: "right" } }); return { default: ResizableRegion, ...ResizableRegion }; });
vi.mock("../src/components/css-transition-group-compat.jsx", () => ({ default: function TransitionGroup() {}, __esModule: true }));
vi.mock("../src/sheet-toolbar.jsx", () => ({ default: function Toolbar() {}, __esModule: true }));
vi.mock("../src/components/drop-zone.jsx", () => ({ default: function DropZone() {} }));
vi.mock("../src/components/disclosure-triangle.jsx", () => ({ default: function DisclosureTriangle() {} }));
vi.mock("../src/components/injected-component-label.jsx", () => ({ default: function InjectedComponentLabel() {} }));

globalThis.NylasEnv = {
	isWorkWindow: vi.fn(() => true), inSpecMode: vi.fn(() => true), inDevMode: vi.fn(() => false), reportError: vi.fn(),
	config: { get: vi.fn(() => null), onDidChange: vi.fn(() => ({ dispose: vi.fn() })) }, getConfigDirPath: vi.fn(() => "/tmp"),
	getPath: vi.fn(() => "/tmp"), getVersion: vi.fn(() => "0.0.0"), getColumnWidth: vi.fn(), storeColumnWidth: vi.fn(),
	setMinimumWidth: vi.fn(), getLoadSettings: vi.fn(() => ({ toolbar: true })),
};

const { default: Sheet } = await import("../src/sheet.jsx");
const SheetContainer = (await import("../src/sheet-container.jsx")).default;
const { default: OutlineView } = await import("../src/components/outline-view.jsx");
const { default: OutlineViewItem } = await import("../src/components/outline-view-item.jsx");
const { default: UnsafeComponent } = await import("../src/components/unsafe-component.jsx");
const InjectedComponentSet = (await import("../src/components/injected-component-set.jsx")).default;

const location = (id) => ({ id, Header: { id: `${id}-header` }, Footer: { id: `${id}-footer` } });
const sheetData = (columns = [location("mail")]) => ({ id: "sheet-1", columns: { list: columns }, Header: { id: "header" }, Footer: { id: "footer" } });
const bare = (Type, props, state = {}) => { const value = Object.create(Type.prototype); value.props = props; value.state = state; value.refs = {}; value.setState = vi.fn((next) => Object.assign(value.state, typeof next === "function" ? next(value.state, value.props) : next)); return value; };
const makeSheet = (props = {}) => { const value = bare(Sheet, { data: sheetData(), depth: 0, onColumnSizeChanged: vi.fn(), ...props }); value.state = value._getStateFromStores(); return value; };
const item = (overrides = {}) => ({ id: "inbox", name: "Inbox", iconName: "folder", children: [], ...overrides });
const makeItem = (overrides = {}) => bare(OutlineViewItem, { item: item(overrides) }, { editing: Boolean(overrides.editing), isDropping: false });

beforeEach(() => {
	vi.clearAllMocks(); m.workspace.layoutMode.mockReturnValue("list"); m.workspace.sheetStack.mockReturnValue([]);
	m.workspace.isLocationHidden.mockReturnValue(false); m.registry.findComponentsMatching.mockReturnValue([]); m.registry.showComponentRegions.mockReturnValue(false);
	NylasEnv.inDevMode.mockReturnValue(false); NylasEnv.getLoadSettings.mockReturnValue({ toolbar: true });
});

describe("Sheet column contracts", () => {
	it("provides its depth through SheetDepthContext", () => { expect(makeSheet({ depth: 3 })._sheetDepthContext()).toEqual({ sheetDepth: 3 }); });
	it("omits hidden locations", () => { m.workspace.isLocationHidden.mockReturnValueOnce(true); expect(makeSheet().state.columns).toEqual([]); });
	it("uses the largest component minimum width", () => { m.registry.findComponentsMatching.mockReturnValue([{ containerStyles: { minWidth: 120 } }, { containerStyles: { minWidth: 240 } }]); expect(makeSheet().state.columns[0].minWidth).toBe(240); });
	it("uses the smallest component maximum width before choosing flex", () => { const cols = [location("one"), location("two")]; m.registry.findComponentsMatching.mockImplementation(({ location: loc }) => loc.id === "one" ? [{ containerStyles: { maxWidth: 300 } }] : [{ containerStyles: { maxWidth: 500 } }]); const result = makeSheet({ data: sheetData(cols) }).state.columns; expect(result.map((col) => col.maxWidth)).toEqual([300, 10000]); });
	it("reads persisted column width", () => { NylasEnv.getColumnWidth.mockReturnValue(333); expect(makeSheet().state.columns[0].width).toBe(333); });
	it("renders the flexible column with flex one", () => { expect(makeSheet()._columnFlexboxElements()[0].props.style.flex).toBe(1); });
	it("stores resized widths by location id", () => { const sheet = makeSheet(); sheet._onColumnResize({ location: { id: "mail" } }, 275); expect(NylasEnv.storeColumnWidth).toHaveBeenCalledWith({ id: "mail", width: 275 }); });
	it("reports the total minimum width after updates", () => { const sheet = makeSheet(); sheet.state.columns = [{ minWidth: 90 }, { minWidth: 110 }]; sheet.componentDidUpdate(); expect(NylasEnv.setMinimumWidth).toHaveBeenCalledWith(200); });
	it("unsubscribes from every store on unmount", () => { const first = vi.fn(); const second = vi.fn(); const sheet = makeSheet(); sheet.unlisteners = [first, second]; sheet.componentWillUnmount(); expect(first).toHaveBeenCalledOnce(); expect(second).toHaveBeenCalledOnce(); });
});

describe("Sheet container contracts", () => {
	const makeContainer = (stack = []) => { m.workspace.sheetStack.mockReturnValue(stack); const value = bare(SheetContainer, {}); value._toolbarRefs = {}; value.state = value._getStateFromStores(); return value; };
	it("renders an empty div without a top sheet", () => { expect(makeContainer().render().type).toBe("div"); });
	it("reflects the workspace layout mode", () => { m.workspace.layoutMode.mockReturnValue("split"); expect(makeContainer([sheetData()]).render().props.className).toBe("layout-mode-split"); });
	it("omits the toolbar when load settings disable it", () => { NylasEnv.getLoadSettings.mockReturnValue({ toolbar: false }); expect(makeContainer([sheetData()])._toolbarContainerElement()).toEqual([]); });
	it("creates one toolbar element per sheet", () => { expect(makeContainer([sheetData(), { ...sheetData(), id: "sheet-2" }])._toolbarElements()).toHaveLength(2); });
	it("creates one sheet element per stack entry", () => { expect(makeContainer([sheetData(), { ...sheetData(), id: "sheet-2" }])._sheetElements()).toHaveLength(2); });
	it("recomputes the toolbar for a resized sheet", () => { const container = makeContainer([sheetData()]); const toolbar = { recomputeLayout: vi.fn() }; container._toolbarRefs = { 0: toolbar }; container._onColumnSizeChanged({ props: { depth: 0 } }); expect(toolbar.recomputeLayout).toHaveBeenCalledOnce(); });
	it("dispatches a window resize after a column changes", () => { const listener = vi.fn(); window.addEventListener("resize", listener, { once: true }); makeContainer([sheetData()])._onColumnSizeChanged({ props: { depth: 0 } }); expect(listener).toHaveBeenCalledOnce(); });
});

describe("Outline view contracts", () => {
	const makeOutline = (props = {}) => bare(OutlineView, { title: "Folders", items: [], collapsed: false, ...props }, { showCreateInput: false });
	it("renders no items while collapsed", () => { expect(makeOutline({ collapsed: true })._renderOutline(false, true).type).toBe("span"); });
	it("renders one item element per model", () => { expect(makeOutline({ items: [item(), item({ id: "sent" })] })._renderItems()).toHaveLength(2); });
});

describe("Outline item contracts", () => {
	it("shows an alternate nonzero count", () => { const view = makeItem({ count: 4, counterStyle: OutlineViewItem.CounterStyles.Alt }); expect(view._renderCount().props.className).toContain("alt-count"); });
	it("renders an empty count span for zero", () => { expect(makeItem({ count: 0 })._renderCount().type).toBe("span"); });
	it("renders children only when expanded", () => { expect(makeItem({ children: [item({ id: "child" })], collapsed: false })._renderChildren().props.className).toBe("item-children"); });
});


describe("Unsafe component contracts", () => {
	const makeUnsafe = (props = {}) => bare(UnsafeComponent, { component: component("Plugin", { containerStyles: { flex: 1 } }), onComponentDidRender: vi.fn(), value: 7, ...props });
	it("applies injected component container styles", () => { expect(makeUnsafe().render().props.style).toEqual({ flex: 1 }); });
	it("omits wrapper-only props from the injected element", () => { const unsafe = makeUnsafe(); m.findDOMNode.mockReturnValue(document.createElement("div")); m.render.mockReturnValue({}); unsafe.renderInjected(); expect(m.render.mock.calls[0][0].props.value).toBe(7); expect(m.render.mock.calls[0][0].props.component).toBeUndefined(); });
	it("reports injected render failures", () => { const error = new Error("broken"); m.findDOMNode.mockReturnValue(document.createElement("div")); m.render.mockImplementationOnce(() => { throw error; }).mockReturnValueOnce({}); makeUnsafe().renderInjected(); expect(NylasEnv.reportError).toHaveBeenCalledWith(error); });
	it("prefers an injected focus method", () => { const unsafe = makeUnsafe(); unsafe.injected = { focus: vi.fn() }; unsafe.focus(); expect(unsafe.injected.focus).toHaveBeenCalledOnce(); });
	it("unmounts the injected React tree", () => { const node = document.createElement("div"); m.findDOMNode.mockReturnValue(node); makeUnsafe().unmountInjected(); expect(m.unmount).toHaveBeenCalledWith(node); });
});
