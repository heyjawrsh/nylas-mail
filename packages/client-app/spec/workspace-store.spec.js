import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	setFocus: vi.fn(), recordUserEvent: vi.fn(),
}));

vi.mock("nylas-store", () => ({
	default: class NylasStore {
		trigger = vi.fn();
		listenTo = vi.fn();
	},
}));
vi.mock("../src/flux/actions.js", () => ({ default: {
	selectRootSheet: {}, setFocus: mocks.setFocus, toggleWorkspaceLocationHidden: {},
	popSheet: {}, popToRootSheet: {}, pushSheet: {}, recordUserEvent: mocks.recordUserEvent,
} }));
vi.mock("../src/flux/stores/account-store.js", () => ({ default: {} }));
vi.mock("../src/flux/stores/category-store.js", () => ({ default: {} }));
vi.mock("../src/mailbox-perspective.js", () => ({ default: class MailboxPerspective {} }));

import workspaceStore from "../src/flux/stores/workspace-store.js";

describe("WorkspaceStore", () => {
	let store;

	beforeEach(() => {
		vi.clearAllMocks();
		NylasEnv.isMainWindow.mockReturnValue(false);
		NylasEnv.config.get.mockImplementation((key) => key === "core.workspace.mode" ? "split" : false);
		store = new workspaceStore.constructor();
		store.triggerDebounced = vi.fn();
		vi.clearAllMocks();
	});

	it("falls back to list mode without a root sheet", () => {
		expect(store.layoutMode()).toBe("list");
	});

	it("defines locations once and reuses them across sheets", () => {
		store.defineSheet("One", {}, { list: ["MessageList"] });
		const location = store.Location.MessageList;
		store.defineSheet("Two", {}, { list: ["MessageList"] });
		expect(store.Sheet.Two.columns.list[0]).toBe(location);
		expect(location.Toolbar.id).toBe("MessageList:Toolbar");
	});

	it("creates sheet-level extension locations", () => {
		store.defineSheet("Search", { name: "Search" }, { list: [] });
		expect(store.Sheet.Search).toEqual(expect.objectContaining({ id: "Search", name: "Search" }));
		expect(store.Sheet.Search.Toolbar.Left.id).toBe("Sheet:Search:Toolbar:Left");
		expect(store.Sheet.Search.Header.id).toBe("Sheet:Search:Header");
	});

	it("automatically selects the first nonsilent root sheet", () => {
		store.defineSheet("Root", { root: true }, { list: [] });
		expect(store.rootSheet()).toBe(store.Sheet.Root);
		expect(store.topSheet()).toBe(store.Sheet.Root);
	});

	it("rejects selecting a missing or non-root sheet", () => {
		expect(() => store._onSelectRootSheet(null)).toThrow("not a valid sheet");
		expect(() => store._onSelectRootSheet({ id: "Child" })).toThrow("not registered as a root sheet");
	});

	it("uses the preferred mode when the root supports it", () => {
		store.defineSheet("Root", { root: true }, { list: [], split: [] });
		expect(store.layoutMode()).toBe("split");
	});

	it("uses the root's first mode when the preference is unsupported", () => {
		store.defineSheet("Root", { root: true }, { list: [] });
		expect(store.layoutMode()).toBe("list");
	});

	it("pushes, pops, and returns to the root sheet", () => {
		store.defineSheet("Root", { root: true }, { list: [] });
		store.defineSheet("Child", {}, { list: [] });
		store.pushSheet(store.Sheet.Child);
		expect(store.topSheet()).toBe(store.Sheet.Child);
		store.popSheet();
		expect(store.sheetStack()).toEqual([store.Sheet.Root]);
		store.pushSheet(store.Sheet.Child);
		store.popToRootSheet();
		expect(store.sheetStack()).toEqual([store.Sheet.Root]);
	});


	it("toggles hidden locations and persists the map", () => {
		const location = { id: "Sidebar" };
		store._onToggleLocationHidden(location);
		expect(store.isLocationHidden(location)).toBe(true);
		expect(store.hiddenLocations()).toEqual([location]);
		expect(NylasEnv.config.set).toHaveBeenCalledWith("core.workspace.hiddenLocations", { Sidebar: location });
		store._onToggleLocationHidden(location);
		expect(store.isLocationHidden(location)).toBe(false);
	});

	it("rejects hiding an object without a location id", () => {
		expect(() => store._onToggleLocationHidden({})).toThrow("pass a WorkspaceStore.Location");
	});


	it("undefines a sheet and requests a debounced publish", () => {
		store.defineSheet("Temporary");
		store.undefineSheet("Temporary");
		expect(store.Sheet.Temporary).toBeUndefined();
		expect(store.triggerDebounced).toHaveBeenCalledTimes(2);
	});
});
