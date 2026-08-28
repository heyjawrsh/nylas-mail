import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ findDOMNode: vi.fn(), uuid: vi.fn(() => "list-1") }));

vi.mock("underscore", () => {
	const underscore = {
		values: (object) => Object.values(object || {}), uniq: (items) => [...new Set(items || [])],
		extend: Object.assign, debounce: (fn) => fn, defer: (fn) => fn(), includes: (items, value) => items.includes(value),
		partial: (fn, ...bound) => (...args) => fn(...bound.map((value) => value === underscore ? args.shift() : value), ...args),
	};
	return { default: underscore, ...underscore };
});
vi.mock("uuid", () => ({ default: { v4: m.uuid }, v4: m.uuid }));
vi.mock("classnames", () => ({ default: (classes) => Object.keys(classes).filter((key) => classes[key]).join(" ") }));
vi.mock("react", () => {
	class Component {
		constructor(props) { this.props = props; this.state = {}; }
		setState(change, callback) { this.state = { ...this.state, ...change }; callback?.(); }
	}
	const react = { Component, createElement: vi.fn(), createRef: () => ({ current: null }), isValidElement: (value) => Boolean(value?.__reactElement) };
	return { default: react, ...react };
});
vi.mock("prop-types", () => ({ default: new Proxy({}, { get: () => Object.assign(() => null, { isRequired: null }) }) }));
vi.mock("react-dom", () => ({ default: { findDOMNode: m.findDOMNode }, findDOMNode: m.findDOMNode }));
vi.mock("../src/components/scroll-region.jsx", () => ({ default: function ScrollRegion() {} }));
vi.mock("../src/components/key-commands-region.jsx", () => ({ default: function KeyCommandsRegion() {} }));
vi.mock("../src/components/retina-img.jsx", () => ({ default: Object.assign(function RetinaImg() {}, { Mode: { ContentIsMask: "mask" } }) }));

import EditableList from "../src/components/editable-list.jsx";

const makeList = (overrides = {}) => new EditableList({
	items: ["one", "two", "three"], itemContent: (item) => item, createInputProps: {},
	onDeleteItem: vi.fn(), onItemEdited: vi.fn(), onItemCreated: vi.fn(), ...overrides,
});
const keyEvent = (key, value = "value") => ({ key, target: { value }, stopPropagation: vi.fn() });

describe("EditableList item callbacks and selection", () => {
	beforeEach(() => { vi.clearAllMocks(); m.findDOMNode.mockReturnValue({ focus: vi.fn() }); });

	it("stores a clicked item when selection is uncontrolled", () => {
		const list = makeList(); list._onItemClick({}, "two", 1);
		expect(list.state.selected).toBe("two");
	});

	it("reports a clicked item when selection is controlled", () => {
		const onSelectItem = vi.fn(); const list = makeList({ selected: "one", onSelectItem }); list._onItemClick({}, "two", 1);
		expect(onSelectItem).toHaveBeenCalledWith("two", 1);
	});

	it("uses the controlled selected prop", () => {
		expect(makeList({ selected: "three", onSelectItem: vi.fn() })._getSelectedItem()).toBe("three");
	});

	it("enters edit mode for the requested row", () => {
		const list = makeList(); list._onItemEdit({}, "two", 1);
		expect(list.state.editingIndex).toBe(1);
	});

	it("commits an edited value on Enter", () => {
		const list = makeList(); list._focusSelf = vi.fn(); const event = keyEvent("Enter", "changed"); list._onEditInputKeyDown(event, "two", 1);
		expect(list.props.onItemEdited).toHaveBeenCalledWith("changed", "two", 1);
	});

	it("cancels editing on Escape without reporting an edit", () => {
		const list = makeList(); list.state.editingIndex = 1; list._focusSelf = vi.fn(); list._onEditInputKeyDown(keyEvent("Escape"), "two", 1);
		expect(list.state.editingIndex).toBe(-1); expect(list.props.onItemEdited).not.toHaveBeenCalled();
	});

	it("moves the edit cursor to the end on focus", () => {
		const input = { value: "hello", selectionStart: 0, selectionEnd: 0 }; makeList()._onEditInputFocus({ target: input });
		expect([input.selectionStart, input.selectionEnd]).toEqual([5, 5]);
	});

	it("creates a non-empty item on input blur", () => {
		const list = makeList(); list._focusSelf = vi.fn(); list._onCreateInputBlur({ target: { value: "new" } });
		expect(list.props.onItemCreated).toHaveBeenCalledWith("new");
	});

	it("does not create an empty item", () => {
		const list = makeList(); list._focusSelf = vi.fn(); list._onCreateInputBlur({ target: { value: "" } });
		expect(list.props.onItemCreated).not.toHaveBeenCalled();
	});

	it("delegates the add button when onCreateItem is supplied", () => {
		const onCreateItem = vi.fn(); makeList({ onCreateItem })._onCreateItem();
		expect(onCreateItem).toHaveBeenCalledOnce();
	});

	it("shows the create input when no add callback is supplied", () => {
		const list = makeList(); list._onCreateItem(); expect(list.state.creatingItem).toBe(true);
	});

	it("deletes the selected item and selects its predecessor", () => {
		const onSelectItem = vi.fn(); const list = makeList({ selected: "two", onSelectItem }); list._onDeleteItem();
		expect(list.props.onDeleteItem).toHaveBeenCalledWith("two", 1); expect(onSelectItem).toHaveBeenCalledWith("one", 0);
	});

	it("selects the second item after deleting the first", () => {
		const onSelectItem = vi.fn(); const list = makeList({ selected: "one", onSelectItem }); list._onDeleteItem();
		expect(onSelectItem).toHaveBeenCalledWith("two", 1);
	});

	it("moves keyboard selection down and stops propagation", () => {
		const onSelectItem = vi.fn(); const event = { stopPropagation: vi.fn() }; const list = makeList({ selected: "one", onSelectItem }); list._scrollTo = vi.fn(); list._listKeymapHandlers()["core:next-item"](event);
		expect(event.stopPropagation).toHaveBeenCalledOnce(); expect(onSelectItem).toHaveBeenCalledWith("two", 1);
	});

	it("does not move keyboard selection past the final item", () => {
		const onSelectItem = vi.fn(); const list = makeList({ selected: "three", onSelectItem }); list._listKeymapHandlers()["core:next-item"]({ stopPropagation: vi.fn() });
		expect(onSelectItem).not.toHaveBeenCalled();
	});
});
