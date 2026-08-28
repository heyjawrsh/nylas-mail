import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
	current: vi.fn(() => ({ threads: vi.fn(() => null) })),
	focused: vi.fn(), fromSelection: vi.fn(), keyboard: vi.fn(), layoutMode: vi.fn(() => "list"),
	listen: vi.fn(), setCursor: vi.fn(), setFocus: vi.fn(), topSheet: vi.fn(() => ({ root: false })),
	trigger: vi.fn(), unlisten: vi.fn(),
}));

vi.mock("nylas-store", () => ({
	default: class NylasStore {
		listenTo(...args) { return m.listen(...args); }
		trigger(...args) { return m.trigger(...args); }
	},
}));

vi.mock("nylas-exports", () => {
	const exports = {
		Actions: { setCursorPosition: m.setCursor, setFocus: m.setFocus },
		DatabaseStore: {}, FocusedPerspectiveStore: { current: m.current },
		FocusedContentStore: { focused: m.focused, keyboardCursor: m.keyboard },
		Message: {}, TaskQueueStatusStore: {}, Thread: {},
		Rx: { Observable: { fromListSelection: m.fromSelection } },
		WorkspaceStore: { layoutMode: m.layoutMode, topSheet: m.topSheet },
	};
	return { default: exports, ...exports };
});

vi.mock("nylas-component-kit", () => {
	class Empty {}
	const exports = { ListTabular: { DataSource: { Empty } } };
	return { default: exports, ...exports };
});

vi.mock("../internal_packages/thread-list/lib/thread-list-data-source", () => ({
	default: class ThreadListDataSource {
		constructor(subscription) { this.subscription = subscription; }
		listen(...args) { m.listen(...args); return m.unlisten; }
	},
}));

// The target exports a CJS singleton, so Vitest exposes it through default interop.
import ThreadListStore from "../internal_packages/thread-list/lib/thread-list-store";

const resultSet = (overrides = {}) => ({
	count: vi.fn(() => 3), matchers: vi.fn(() => null), modelAtOffset: vi.fn((i) => ({ id: `next-${i}`, unread: false })),
	offsetOfId: vi.fn(() => 1), query: vi.fn(), ...overrides,
});

describe("ThreadListStore", () => {
	let store;

	beforeEach(() => {
		vi.clearAllMocks();
		m.current.mockReturnValue({ threads: vi.fn(() => null) });
		m.layoutMode.mockReturnValue("list");
		m.topSheet.mockReturnValue({ root: false });
		store = new ThreadListStore.constructor();
		vi.clearAllMocks();
	});

	it("constructs an empty data source when the perspective has no threads", () => {
		store.createListDataSource();
		expect(store.dataSource().constructor.name).toBe("Empty");
		expect(m.setFocus).toHaveBeenCalledWith({ collection: "thread", item: null });
	});

	it("constructs and listens to a data source for a thread subscription", () => {
		const subscription = { id: "subscription" };
		m.current.mockReturnValue({ threads: () => subscription });
		store.createListDataSource();
		expect(store.dataSource().subscription).toBe(subscription);
		expect(m.listen).toHaveBeenCalledWith(store._onDataChanged, store);
	});

	it("unlistens the previous data source before replacement", () => {
		store._dataSourceUnlisten = m.unlisten;
		store.createListDataSource();
		expect(m.unlisten).toHaveBeenCalledOnce();
	});

	it("publishes the store after replacing its data source", () => {
		store.createListDataSource();
		expect(m.trigger).toHaveBeenCalledWith(store);
	});

	it("recreates the data source when perspective changes", () => {
		vi.spyOn(store, "createListDataSource").mockImplementation(() => "created");
		expect(store._onPerspectiveChanged()).toBe("created");
	});

	it("creates the selection observable from itself", () => {
		m.fromSelection.mockReturnValue("observable");
		expect(store.selectionObservable()).toBe("observable");
		expect(m.fromSelection).toHaveBeenCalledWith(store);
	});

	it("ignores incomplete data change notifications", () => {
		store._onDataChanged({ previous: resultSet() });
		expect(m.setFocus).not.toHaveBeenCalled();
		expect(m.setCursor).not.toHaveBeenCalled();
	});

	it("advances focus in split view when the focused thread disappears", () => {
		const focused = { id: "gone" };
		m.focused.mockReturnValue(focused);
		m.layoutMode.mockReturnValue("split");
		const previous = resultSet({ offsetOfId: vi.fn(() => 1) });
		const next = resultSet({ offsetOfId: vi.fn(() => -1), query: () => ({ matchers: () => null }) });
		store._onDataChanged({ previous, next });
		expect(m.setFocus).toHaveBeenCalledWith({ collection: "thread", item: expect.objectContaining({ id: "next-1" }) });
	});

	it("does not autofocus a disappeared thread in list view", () => {
		m.focused.mockReturnValue({ id: "gone" });
		const next = resultSet({ offsetOfId: () => -1, query: () => ({ matchers: () => null }) });
		store._onDataChanged({ previous: resultSet(), next });
		expect(m.setFocus).not.toHaveBeenCalled();
	});

	it("moves the keyboard cursor even when the view does not autofocus", () => {
		m.keyboard.mockReturnValue({ id: "gone" });
		const next = resultSet({ offsetOfId: () => -1, query: () => ({ matchers: () => null }) });
		store._onDataChanged({ previous: resultSet({ offsetOfId: () => 2 }), next });
		expect(m.setCursor).toHaveBeenCalledWith({ collection: "thread", item: expect.objectContaining({ id: "next-2" }) });
	});

	it("backs up to an unread preceding row", () => {
		m.keyboard.mockReturnValue({ id: "gone" });
		const modelAtOffset = vi.fn((i) => ({ id: `next-${i}`, unread: i === 1 }));
		const next = resultSet({ modelAtOffset, offsetOfId: () => -1, query: () => ({ matchers: () => null }) });
		store._onDataChanged({ previous: resultSet({ offsetOfId: () => 2 }), next });
		expect(m.setCursor).toHaveBeenCalledWith({ collection: "thread", item: { id: "next-1", unread: true } });
	});

	it("backs up when the old index is beyond the new result count", () => {
		m.keyboard.mockReturnValue({ id: "gone" });
		const next = resultSet({ count: () => 2, offsetOfId: () => -1, query: () => ({ matchers: () => null }) });
		store._onDataChanged({ previous: resultSet({ offsetOfId: () => 3 }), next });
		expect(m.setCursor).toHaveBeenCalledWith({ collection: "thread", item: expect.objectContaining({ id: "next-2" }) });
	});

	it("uses query matchers to detect a model that no longer belongs", () => {
		const keyboard = { id: "still-loaded", matches: vi.fn(() => false) };
		m.keyboard.mockReturnValue(keyboard);
		const matchers = ["inbox"];
		const next = resultSet({ offsetOfId: () => 0, query: () => ({ matchers: () => matchers }) });
		store._onDataChanged({ previous: resultSet({ offsetOfId: () => 0 }), next });
		expect(keyboard.matches).toHaveBeenCalledWith(matchers);
		expect(m.setCursor).toHaveBeenCalledOnce();
	});
});
