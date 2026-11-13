import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ layoutMode: vi.fn(() => "list"), listen: vi.fn(), topSheet: vi.fn(() => ({ root: true })), listHandler: vi.fn(), splitHandler: vi.fn() }));

vi.mock("prop-types", () => ({ default: new Proxy({}, { get: () => Object.assign(() => null, { isRequired: null }) }) }));
vi.mock("underscore", () => { const underscore = { values: (o) => Object.values(o || {}), uniq: (a) => [...new Set(a || [])], extend: Object.assign, debounce: (fn) => fn, defer: (fn) => fn(), isEqual: (a, b) => a === b }; return { default: underscore, ...underscore }; });
vi.mock("react", () => { class Component {} const react = { Component, createElement: (type, props, ...children) => ({ type, props: { ...props, children } }), createRef: () => ({ current: null }) }; return { default: react, ...react }; });
vi.mock("classnames", () => ({ default: (classes) => Object.keys(classes).filter((key) => classes[key]).join(" ") }));
vi.mock("../src/components/list-tabular.jsx", () => ({ default: Object.assign(function ListTabular() {}, { Column: class Column { constructor(options) { Object.assign(this, options); } } }) }));
vi.mock("../src/components/spinner.jsx", () => ({ default: function Spinner() {} }));
vi.mock("nylas-exports", () => ({ default: {}, Actions: {}, Utils: { fastOmit: (object, keys) => Object.fromEntries(Object.entries(object).filter(([key]) => !keys.includes(key))) }, WorkspaceStore: { layoutMode: m.layoutMode, listen: m.listen, topSheet: m.topSheet }, AccountStore: {} }));
vi.mock("nylas-component-kit", () => ({ default: {}, KeyCommandsRegion: function KeyCommandsRegion() {} }));
vi.mock("node:events", () => ({ default: { EventEmitter: class EventEmitter {} }, EventEmitter: class EventEmitter {} }));
vi.mock("../src/components/multiselect-list-interaction-handler.js", () => ({ default: class ListHandler { constructor(props) { m.listHandler(props); } } }));
vi.mock("../src/components/multiselect-split-interaction-handler.js", () => ({ default: class SplitHandler { constructor(props) { m.splitHandler(props); } } }));

import MultiselectList from "../src/components/multiselect-list.jsx";

const makeList = (overrides = {}) => {
	const instance = Object.create(MultiselectList.prototype);
	instance.props = { className: "mail", columns: [{ name: "Subject" }], itemPropsProvider: () => ({}), dataSource: { itemsCurrentlyInViewMatching: () => ["a", "b"] }, ...overrides };
	instance.state = { handler: null, layoutMode: "list" };
	instance._rootRef = { current: null };
	instance._listRef = { current: null };
	instance.setState = vi.fn((next) => { instance.state = { ...instance.state, ...next }; });
	return instance;
};

describe("MultiselectList selection and keyboard handlers", () => {
	beforeEach(() => { vi.clearAllMocks(); m.layoutMode.mockReturnValue("list"); m.topSheet.mockReturnValue({ root: true }); });

	it("routes an ordinary click to the handler", () => {
		const list = makeList(); list.state.handler = { onClick: vi.fn() }; list._onClickItem("item", {}); expect(list.state.handler.onClick).toHaveBeenCalledWith("item");
	});

	it("routes a command click to meta selection", () => {
		const list = makeList(); list.state.handler = { onMetaClick: vi.fn() }; list._onClickItem("item", { metaKey: true }); expect(list.state.handler.onMetaClick).toHaveBeenCalledWith("item");
	});

	it("routes a control click to meta selection", () => {
		const list = makeList(); list.state.handler = { onMetaClick: vi.fn() }; list._onClickItem("item", { ctrlKey: true }); expect(list.state.handler.onMetaClick).toHaveBeenCalledWith("item");
	});

	it("routes a shift click to range selection", () => {
		const list = makeList(); list.state.handler = { onShiftClick: vi.fn() }; list._onClickItem("item", { shiftKey: true }); expect(list.state.handler.onShiftClick).toHaveBeenCalledWith("item");
	});

	it("forwards Enter to the active interaction handler", () => {
		const list = makeList(); list.state.handler = { onEnter: vi.fn() }; list._onEnter(); expect(list.state.handler.onEnter).toHaveBeenCalledOnce();
	});

	it("forwards keyboard selection to the active handler", () => {
		const list = makeList(); list.state.handler = { onSelectKeyboardItem: vi.fn() }; list._onSelectKeyboardItem(); expect(list.state.handler.onSelectKeyboardItem).toHaveBeenCalledOnce();
	});

	it("selects every item currently in view", () => {
		const list = makeList(); list.state.handler = { onSelect: vi.fn() }; list._onSelectAll(); expect(list.state.handler.onSelect).toHaveBeenCalledWith(["a", "b"]);
	});

	it("does not deselect when a list-layout sheet is hidden", () => {
		m.topSheet.mockReturnValue({ root: false }); const list = makeList(); list.state.handler = { onDeselect: vi.fn() }; list._onDeselect(); expect(list.state.handler.onDeselect).not.toHaveBeenCalled();
	});

	it("deselects when visible", () => {
		const list = makeList(); list.state.handler = { onDeselect: vi.fn() }; list._onDeselect(); expect(list.state.handler.onDeselect).toHaveBeenCalledOnce();
	});

	it("forwards keyboard movement options", () => {
		const list = makeList(); list.state.handler = { onShift: vi.fn() }; list._onShift(1, { select: true }); expect(list.state.handler.onShift).toHaveBeenCalledWith(1, { select: true });
	});

	it("maps next-item to a positive shift", () => {
		const list = makeList(); list._onShift = vi.fn(); list._globalKeymapHandlers()["core:next-item"](); expect(list._onShift).toHaveBeenCalledWith(1);
	});

	it("maps select-up to an extending negative shift", () => {
		const list = makeList(); list._onShift = vi.fn(); list._globalKeymapHandlers()["core:select-up"](); expect(list._onShift).toHaveBeenCalledWith(-1, { select: true });
	});

	it("scrolls the backing list by a page", () => {
		const list = makeList(); list._listRef.current = { scrollByPage: vi.fn() }; list._onScrollByPage(-1); expect(list._listRef.current.scrollByPage).toHaveBeenCalledWith(-1);
	});

	it("subscribes to workspace changes on setup", () => {
		m.listen.mockReturnValue("unsubscribe"); const list = makeList(); list._onChange = vi.fn(); list.setupForProps(list.props); expect(list.unsubscribers).toEqual(["unsubscribe"]);
	});

	it("tears down every workspace subscription", () => {
		const first = vi.fn(); const second = vi.fn(); const list = makeList(); list.unsubscribers = [first, second]; list.teardownForProps(); expect(first).toHaveBeenCalledOnce(); expect(second).toHaveBeenCalledOnce();
	});

	it("prepends the checkmark column in list layout", () => {
		const list = makeList(); const state = list._getStateFromStores(); expect(state.computedColumns).toHaveLength(2); expect(state.computedColumns[0].name).toBe("Check"); expect(m.listHandler).toHaveBeenCalledWith(list.props);
	});

	it("uses split interaction without a checkmark column", () => {
		m.layoutMode.mockReturnValue("split"); const list = makeList(); const state = list._getStateFromStores(); expect(state.computedColumns).toEqual(list.props.columns); expect(m.splitHandler).toHaveBeenCalledWith(list.props);
	});

	it("returns the item id at a document point", () => {
		const list = makeList(); const original = document.elementFromPoint; document.elementFromPoint = vi.fn(() => ({ closest: () => ({ dataset: { itemId: "mail-7" } }) })); expect(list.itemIdAtPoint(2, 3)).toBe("mail-7"); document.elementFromPoint = original;
	});
});
