import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	topSheet: vi.fn(() => ({ root: false })),
}));

vi.mock("nylas-exports", () => ({
	Actions: {},
	WorkspaceStore: { topSheet: mocks.topSheet },
}));

import ListHandler from "../src/components/multiselect-list-interaction-handler.js";
import SplitHandler from "../src/components/multiselect-split-interaction-handler.js";

const items = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];

function makeFixture(overrides = {}) {
	let selected = overrides.selected ? [...overrides.selected] : [];
	const selection = {
		toggle: vi.fn((item) => {
			selected = selected.includes(item)
				? selected.filter((candidate) => candidate !== item)
				: [...selected, item];
		}),
		expandTo: vi.fn(),
		clear: vi.fn(() => { selected = []; }),
		set: vi.fn((next) => { selected = [...next]; }),
		add: vi.fn((item) => {
			if (item && !selected.includes(item)) selected.push(item);
		}),
		walk: vi.fn(),
		count: vi.fn(() => selected.length),
		items: vi.fn(() => selected),
		top: vi.fn(() => selected[0]),
	};
	const dataSource = {
		selection,
		getById: vi.fn((id) => items.find((item) => item.id === id)),
		indexOfId: vi.fn((id) => items.findIndex((item) => item.id === id)),
		count: vi.fn(() => items.length),
		get: vi.fn((index) => items[index]),
	};
	return {
		selection,
		dataSource,
		props: {
			dataSource,
			focused: items[0],
			focusedId: "a",
			keyboardCursorId: null,
			onFocusItem: vi.fn(),
			onSetCursorPosition: vi.fn(),
			...overrides,
		},
	};
}

beforeEach(() => {
	vi.clearAllMocks();
	mocks.topSheet.mockReturnValue({ root: false });
});

describe("MultiselectListInteractionHandler", () => {
	it("uses list presentation flags", () => {
		const handler = new ListHandler(makeFixture().props);
		expect(handler.cssClass()).toBe("handler-list");
		expect(handler.shouldShowFocus()).toBe(false);
		expect(handler.shouldShowCheckmarks()).toBe(true);
		expect(handler.shouldShowKeyboardCursor()).toBe(true);
	});

	it("focuses a clicked fixture item", () => {
		const fixture = makeFixture();
		new ListHandler(fixture.props).onClick(items[1]);
		expect(fixture.props.onFocusItem).toHaveBeenCalledWith(items[1]);
	});

	it("toggles and moves the cursor on meta click", () => {
		const fixture = makeFixture();
		new ListHandler(fixture.props).onMetaClick(items[2]);
		expect(fixture.selection.toggle).toHaveBeenCalledWith(items[2]);
		expect(fixture.props.onSetCursorPosition).toHaveBeenCalledWith(items[2]);
	});

	it("expands and moves the cursor on shift click", () => {
		const fixture = makeFixture();
		new ListHandler(fixture.props).onShiftClick(items[3]);
		expect(fixture.selection.expandTo).toHaveBeenCalledWith(items[3]);
		expect(fixture.props.onSetCursorPosition).toHaveBeenCalledWith(items[3]);
	});

	it("enters the keyboard cursor item", () => {
		const fixture = makeFixture({ keyboardCursorId: "c" });
		new ListHandler(fixture.props).onEnter();
		expect(fixture.props.onFocusItem).toHaveBeenCalledWith(items[2]);
	});

	it("does nothing on enter without a keyboard cursor", () => {
		const fixture = makeFixture();
		new ListHandler(fixture.props).onEnter();
		expect(fixture.props.onFocusItem).not.toHaveBeenCalled();
	});

	it("clears selection on deselect", () => {
		const fixture = makeFixture({ selected: items.slice(0, 2) });
		new ListHandler(fixture.props).onDeselect();
		expect(fixture.selection.clear).toHaveBeenCalledOnce();
	});

	it("replaces selection with fixture items", () => {
		const fixture = makeFixture();
		new ListHandler(fixture.props).onSelect(items.slice(1, 3));
		expect(fixture.selection.set).toHaveBeenCalledWith(items.slice(1, 3));
	});

	it("toggles the focused item from keyboard context", () => {
		const fixture = makeFixture({ focusedId: "b" });
		new ListHandler(fixture.props).onSelectKeyboardItem();
		expect(fixture.selection.toggle).toHaveBeenCalledWith(items[1]);
	});

	it("toggles the cursor item while a root sheet is open", () => {
		mocks.topSheet.mockReturnValue({ root: true });
		const fixture = makeFixture({ focusedId: "a", keyboardCursorId: "d" });
		new ListHandler(fixture.props).onSelectKeyboardItem();
		expect(fixture.selection.toggle).toHaveBeenCalledWith(items[3]);
	});

	it("does not toggle when keyboard context has no id", () => {
		const fixture = makeFixture({ focusedId: null });
		new ListHandler(fixture.props).onSelectKeyboardItem();
		expect(fixture.selection.toggle).not.toHaveBeenCalled();
	});

	it("shifts focus and clamps at the last item", () => {
		const fixture = makeFixture({ focusedId: "c" });
		new ListHandler(fixture.props).onShift(10);
		expect(fixture.props.onFocusItem).toHaveBeenCalledWith(items[3]);
	});

	it("shifts a root-sheet cursor and clamps at the first item", () => {
		mocks.topSheet.mockReturnValue({ root: true });
		const fixture = makeFixture({ keyboardCursorId: "b" });
		new ListHandler(fixture.props).onShift(-10);
		expect(fixture.props.onSetCursorPosition).toHaveBeenCalledWith(items[0]);
	});

	it("walks selection between current and shifted items", () => {
		const fixture = makeFixture({ focusedId: "b" });
		new ListHandler(fixture.props).onShift(1, { select: true });
		expect(fixture.selection.walk).toHaveBeenCalledWith({
			current: items[1], next: items[2],
		});
	});
});

describe("MultiselectSplitInteractionHandler", () => {
	it("shows a keyboard cursor only for multiple selected items", () => {
		expect(new SplitHandler(makeFixture({ selected: [items[0]] }).props).shouldShowKeyboardCursor()).toBe(false);
		expect(new SplitHandler(makeFixture({ selected: items.slice(0, 2) }).props).shouldShowKeyboardCursor()).toBe(true);
	});

	it("clicks focus, clears selection, and keeps the new focus", () => {
		const fixture = makeFixture({ focused: null });
		new SplitHandler(fixture.props).onClick(items[2]);
		expect(fixture.props.onFocusItem).toHaveBeenCalledWith(items[2]);
		expect(fixture.selection.clear).toHaveBeenCalledOnce();
	});

	it("turns focus into selection before meta toggling", () => {
		const fixture = makeFixture();
		new SplitHandler(fixture.props).onMetaClick(items[2]);
		expect(fixture.props.onFocusItem).toHaveBeenCalledWith(null);
		expect(fixture.selection.add).toHaveBeenCalledWith(items[0]);
		expect(fixture.selection.toggle).toHaveBeenCalledWith(items[2]);
	});

	it("turns focus into selection before shift expansion", () => {
		const fixture = makeFixture();
		new SplitHandler(fixture.props).onShiftClick(items[3]);
		expect(fixture.selection.add).toHaveBeenCalledWith(items[0]);
		expect(fixture.selection.expandTo).toHaveBeenCalledWith(items[3]);
	});

	it("moves a lone selection back to focus after deselect math", () => {
		const fixture = makeFixture({ focused: null, selected: [items[1]] });
		new SplitHandler(fixture.props).onSelectKeyboardItem();
		expect(fixture.props.onFocusItem).toHaveBeenCalledWith(items[1]);
		expect(fixture.selection.clear).toHaveBeenCalledOnce();
	});

	it("adds focused item and clears focus when selecting items", () => {
		const fixture = makeFixture();
		new SplitHandler(fixture.props).onSelect([items[2], items[3]]);
		expect(fixture.selection.add).toHaveBeenCalledWith(items[0]);
		expect(fixture.props.onFocusItem).toHaveBeenCalledWith(null);
	});

	it("shifts focus when selection is empty", () => {
		const fixture = makeFixture({ focusedId: "b" });
		new SplitHandler(fixture.props).onShift(1, {});
		expect(fixture.props.onFocusItem).toHaveBeenCalledWith(items[2]);
	});

	it("shifts the keyboard cursor when selection exists", () => {
		const fixture = makeFixture({ selected: [items[1], items[2]], keyboardCursorId: "b" });
		new SplitHandler(fixture.props).onShift(1, {});
		expect(fixture.props.onSetCursorPosition).toHaveBeenCalledWith(items[2]);
	});

	it("uses the top selected item when no keyboard cursor exists", () => {
		const fixture = makeFixture({ focused: null, selected: [items[2], items[3]] });
		new SplitHandler(fixture.props).onShift(-1, {});
		expect(fixture.props.onSetCursorPosition).toHaveBeenCalledWith(items[1]);
	});

	it("turns focus into selection and walks during selecting shift", () => {
		const fixture = makeFixture({ focusedId: "a" });
		new SplitHandler(fixture.props).onShift(1, { select: true });
		expect(fixture.selection.add).toHaveBeenCalledWith(items[0]);
		expect(fixture.selection.walk).toHaveBeenCalledWith({ current: items[0], next: items[1] });
	});
});
