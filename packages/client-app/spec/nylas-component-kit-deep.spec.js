import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => {
	const component = (name) => ({ name });
	const attachmentItems = {
		AttachmentItem: component("AttachmentItem"),
		ImageAttachmentItem: component("ImageAttachmentItem"),
	};
	return { component, attachmentItems };
});

// Keep every JSX edge registered by initClass isolated. Most registrations are
// lazy, but declaring all of them prevents a property assertion from pulling a
// component's dependency graph into this unit suite.
vi.mock("../src/components/menu.jsx", () => ({ default: m.component("Menu") }));
vi.mock("../src/components/drop-zone.jsx", () => ({ default: m.component("DropZone") }));
vi.mock("../src/components/spinner.jsx", () => ({ default: m.component("Spinner") }));
vi.mock("../src/components/switch.jsx", () => ({ default: m.component("Switch") }));
vi.mock("../src/components/fixed-popover.jsx", () => ({ default: m.component("FixedPopover") }));
vi.mock("../src/components/date-picker-popover.jsx", () => ({ default: m.component("DatePickerPopover") }));
vi.mock("../src/components/modal.jsx", () => ({ default: m.component("Modal") }));
vi.mock("../src/components/webview.jsx", () => ({ default: m.component("Webview") }));
vi.mock("../src/components/feature-used-up-modal.jsx", () => ({ default: m.component("FeatureUsedUpModal") }));
vi.mock("../src/components/billing-modal.jsx", () => ({ default: m.component("BillingModal") }));
vi.mock("../src/components/flexbox.jsx", () => ({ default: m.component("Flexbox") }));
vi.mock("../src/components/retina-img.jsx", () => ({ default: m.component("RetinaImg") }));
vi.mock("../src/components/swipe-container.jsx", () => ({ default: m.component("SwipeContainer") }));
vi.mock("../src/components/flux-container.jsx", () => ({ default: m.component("FluxContainer") }));
vi.mock("../src/components/focus-container.jsx", () => ({ default: m.component("FocusContainer") }));
vi.mock("../src/components/syncing-list-state.jsx", () => ({ default: m.component("SyncingListState") }));
vi.mock("../src/components/empty-list-state.jsx", () => ({ default: m.component("EmptyListState") }));
vi.mock("../src/components/list-tabular.jsx", () => ({ default: m.component("ListTabular") }));
vi.mock("../src/components/notification.jsx", () => ({ default: m.component("Notification") }));
vi.mock("../src/components/nylas-calendar/nylas-calendar.jsx", () => ({ default: m.component("NylasCalendar") }));
vi.mock("../src/components/nylas-calendar/mini-month-view.jsx", () => ({ default: m.component("MiniMonthView") }));
vi.mock("../src/components/evented-iframe.jsx", () => ({ default: m.component("EventedIFrame") }));
vi.mock("../src/components/button-dropdown.jsx", () => ({ default: m.component("ButtonDropdown") }));
vi.mock("../src/components/multiselect-list.jsx", () => ({ default: m.component("MultiselectList") }));
vi.mock("../src/components/bolded-search-result.jsx", () => ({ default: m.component("BoldedSearchResult") }));
vi.mock("../src/components/multiselect-dropdown.jsx", () => ({ default: m.component("MultiselectDropdown") }));
vi.mock("../src/components/key-commands-region.jsx", () => ({ default: m.component("KeyCommandsRegion") }));
vi.mock("../src/components/tab-group-region.jsx", () => ({ default: m.component("TabGroupRegion") }));
vi.mock("../src/components/injected-component.jsx", () => ({ default: m.component("InjectedComponent") }));
vi.mock("../src/components/tokenizing-text-field.jsx", () => ({ default: m.component("TokenizingTextField") }));
vi.mock("../src/components/participants-text-field.jsx", () => ({ default: m.component("ParticipantsTextField") }));
vi.mock("../src/components/multiselect-toolbar.jsx", () => ({ default: m.component("MultiselectToolbar") }));
vi.mock("../src/components/injected-component-set.jsx", () => ({ default: m.component("InjectedComponentSet") }));
vi.mock("../src/components/config-prop-container.jsx", () => ({ default: m.component("ConfigPropContainer") }));
vi.mock("../src/components/disclosure-triangle.jsx", () => ({ default: m.component("DisclosureTriangle") }));
vi.mock("../src/components/editable-list.jsx", () => ({ default: m.component("EditableList") }));
vi.mock("../src/components/outline-view-item.jsx", () => ({ default: m.component("OutlineViewItem") }));
vi.mock("../src/components/outline-view.jsx", () => ({ default: m.component("OutlineView") }));
vi.mock("../src/components/date-input.jsx", () => ({ default: m.component("DateInput") }));
vi.mock("../src/components/date-picker.jsx", () => ({ default: m.component("DatePicker") }));
vi.mock("../src/components/time-picker.jsx", () => ({ default: m.component("TimePicker") }));
vi.mock("../src/components/table/table.jsx", () => ({ default: m.component("Table"), TableRow: m.component("TableRow"), TableCell: m.component("TableCell") }));
vi.mock("../src/components/selectable-table.jsx", () => ({ default: m.component("SelectableTable"), SelectableTableRow: m.component("SelectableTableRow"), SelectableTableCell: m.component("SelectableTableCell") }));
vi.mock("../src/components/editable-table.jsx", () => ({ default: m.component("EditableTable"), EditableTableCell: m.component("EditableTableCell") }));
vi.mock("../src/components/toast.jsx", () => ({ default: m.component("Toast") }));
vi.mock("../src/components/undo-toast.jsx", () => ({ default: m.component("UndoToast") }));
vi.mock("../src/components/lazy-rendered-list.jsx", () => ({ default: m.component("LazyRenderedList") }));
vi.mock("../src/components/oauth-signin-page.jsx", () => ({ default: m.component("OAuthSignInPage") }));
vi.mock("../src/components/attachment-items.jsx", () => ({ default: m.attachmentItems, ...m.attachmentItems }));
vi.mock("../src/components/code-snippet.jsx", () => ({ default: m.component("CodeSnippet") }));
vi.mock("../src/components/dropdown-menu.jsx", () => ({ default: m.component("DropdownMenu") }));
vi.mock("../src/components/scroll-region.jsx", () => ({ default: m.component("ScrollRegion") }));
vi.mock("../src/components/resizable-region.jsx", () => ({ default: m.component("ResizableRegion") }));
vi.mock("../src/components/mail-label.jsx", () => ({ default: m.component("MailLabel"), MailLabel: m.component("MailLabel"), LabelColorizer: m.component("LabelColorizer") }));
vi.mock("../src/components/mail-label-set.jsx", () => ({ default: m.component("MailLabelSet") }));
vi.mock("../src/components/mail-important-icon.jsx", () => ({ default: m.component("MailImportantIcon") }));
vi.mock("../src/components/generated-form.jsx", () => ({ default: m.component("GeneratedForm"), FormItem: m.component("FormItem"), GeneratedForm: m.component("GeneratedForm"), GeneratedFieldset: m.component("GeneratedFieldset") }));
vi.mock("../src/components/scenario-editor.jsx", () => ({ default: m.component("ScenarioEditor") }));
vi.mock("../src/components/search-bar.jsx", () => ({ default: m.component("SearchBar") }));
vi.mock("../src/components/decorators/has-tutorial-tip.jsx", () => ({ default: m.component("HasTutorialTip") }));

globalThis.NylasEnv = {
	isWorkWindow: vi.fn(() => true),
	inSpecMode: vi.fn(() => true),
	inDevMode: vi.fn(() => false),
	reportError: vi.fn(),
	config: { get: vi.fn(() => null), onDidChange: vi.fn(() => ({ dispose: vi.fn() })) },
	getConfigDirPath: vi.fn(() => "/tmp"),
	getPath: vi.fn(() => "/tmp"),
	getVersion: vi.fn(() => "0.0.0"),
};

await import("../src/global/nylas-component-kit.js");
const NylasComponentKit = globalThis.NylasComponentKitClass;

const runInitClass = () => {
	// requireFrom is intentionally eager. Stub only that registration hook while
	// exercising initClass so native require never parses JSX before Vitest can
	// serve the declared module mocks.
	const requireFrom = vi.spyOn(NylasComponentKit, "requireFrom").mockImplementation((prop) =>
		Object.defineProperty(NylasComponentKit.prototype, prop, {
			configurable: true,
			get: () => m.attachmentItems[prop],
		}),
	);
	NylasComponentKit.initClass();
	requireFrom.mockRestore();
	return requireFrom;
};

describe("NylasComponentKit deep registration behavior", () => {
	beforeEach(() => {
		globalThis.NylasEnv.inDevMode.mockReturnValue(false);
		globalThis.NylasEnv.inSpecMode.mockReturnValue(true);
	});

	it("returns null when an interop module has a null default", () => {
		expect(NylasComponentKit.default({ default: null })).toEqual({ default: null });
	});

	it("returns a false default export", () => {
		expect(NylasComponentKit.default({ default: false })).toBe(false);
	});

	it("runs a load thunk on first access", () => {
		const thunk = vi.fn(() => ({ default: "first" }));
		NylasComponentKit.load("DeepLazyFirst", thunk);
		expect(new NylasComponentKit().DeepLazyFirst).toBe("first");
		expect(thunk).toHaveBeenCalledOnce();
	});

	it("does not cache a load thunk between accesses", () => {
		const thunk = vi.fn(() => ({ default: thunk.mock.calls.length }));
		NylasComponentKit.load("DeepLazyRepeat", thunk);
		const kit = new NylasComponentKit();
		expect([kit.DeepLazyRepeat, kit.DeepLazyRepeat]).toEqual([1, 2]);
	});

	it("does not cache a load thunk between instances", () => {
		const thunk = vi.fn(() => ({ default: Symbol() }));
		NylasComponentKit.load("DeepLazyInstances", thunk);
		expect(new NylasComponentKit().DeepLazyInstances).not.toBe(new NylasComponentKit().DeepLazyInstances);
	});

	it("keeps a load registration non-enumerable", () => {
		NylasComponentKit.load("DeepLazyEnumerable", () => ({ default: true }));
		expect(Object.keys(NylasComponentKit.prototype)).not.toContain("DeepLazyEnumerable");
	});

	it("unwraps the default returned by a load thunk", () => {
		const value = {};
		NylasComponentKit.load("DeepLazyDefault", () => ({ default: value }));
		expect(new NylasComponentKit().DeepLazyDefault).toBe(value);
	});

	it("runs a require thunk during registration", () => {
		const thunk = vi.fn(() => ({ default: "eager" }));
		NylasComponentKit.require("DeepEagerFirst", thunk);
		expect(thunk).toHaveBeenCalledOnce();
	});

	it("caches a require thunk result across accesses", () => {
		const thunk = vi.fn(() => ({ default: {} }));
		NylasComponentKit.require("DeepEagerCached", thunk);
		const kit = new NylasComponentKit();
		expect(kit.DeepEagerCached).toBe(kit.DeepEagerCached);
		expect(thunk).toHaveBeenCalledOnce();
	});

	it("selects a named export with requireFrom", () => {
		NylasComponentKit.requireFrom("DeepNamedEager", () => ({ DeepNamedEager: 42 }));
		expect(new NylasComponentKit().DeepNamedEager).toBe(42);
	});

	it("caches a requireFrom thunk during registration", () => {
		const thunk = vi.fn(() => ({ DeepNamedCached: {} }));
		NylasComponentKit.requireFrom("DeepNamedCached", thunk);
		const kit = new NylasComponentKit();
		void kit.DeepNamedCached;
		void kit.DeepNamedCached;
		expect(thunk).toHaveBeenCalledOnce();
	});

	it("selects a named export with loadFrom", () => {
		NylasComponentKit.loadFrom("DeepNamedLazy", () => ({ DeepNamedLazy: "named" }));
		expect(new NylasComponentKit().DeepNamedLazy).toBe("named");
	});

	it("does not cache a loadFrom thunk", () => {
		const thunk = vi.fn(() => ({ DeepNamedRepeat: thunk.mock.calls.length }));
		NylasComponentKit.loadFrom("DeepNamedRepeat", thunk);
		const kit = new NylasComponentKit();
		expect([kit.DeepNamedRepeat, kit.DeepNamedRepeat]).toEqual([1, 2]);
	});

	it("makes deprecated registrations enumerable", () => {
		NylasComponentKit.loadDeprecated("DeepDeprecatedEnumerable", () => "old", { instead: "newAPI" });
		expect(Object.keys(NylasComponentKit.prototype)).toContain("DeepDeprecatedEnumerable");
	});

	it("warns with the deprecated and replacement names", () => {
		globalThis.NylasEnv.inDevMode.mockReturnValue(true);
		globalThis.NylasEnv.inSpecMode.mockReturnValue(false);
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		NylasComponentKit.loadDeprecated("DeepOldAPI", () => "old", { instead: "DeepNewAPI" });
		expect(new NylasComponentKit().DeepOldAPI).toBe("old");
		expect(warn).toHaveBeenCalledWith(expect.stringMatching(/^Deprecation warning! DeepOldAPI is deprecated and will be removed soon\. Use DeepNewAPI instead\.\nCheck your code at /));
		warn.mockRestore();
	});

	it("warns only once for a deprecated registration", () => {
		globalThis.NylasEnv.inDevMode.mockReturnValue(true);
		globalThis.NylasEnv.inSpecMode.mockReturnValue(false);
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		NylasComponentKit.loadDeprecated("DeepOldOnce", () => "old", { instead: "DeepNewOnce" });
		const kit = new NylasComponentKit();
		void kit.DeepOldOnce;
		void kit.DeepOldOnce;
		expect(warn).toHaveBeenCalledOnce();
		warn.mockRestore();
	});

	it("does not warn for deprecated access in spec mode", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		NylasComponentKit.loadDeprecated("DeepOldSpec", () => "old", { instead: "DeepNewSpec" });
		void new NylasComponentKit().DeepOldSpec;
		expect(warn).not.toHaveBeenCalled();
		warn.mockRestore();
	});

	it("registers the complete component surface when initClass runs explicitly", () => {
		runInitClass();
		const expected = ["Menu", "Popover", "DatePickerPopover", "OpenIdentityPageButton", "NylasCalendar", "Contenteditable", "MultiselectActionBar", "Table", "TableRow", "SelectableTableCell", "EditableTableCell", "OverlaidComponents", "AttachmentItem", "ImageAttachmentItem", "MailLabel", "LabelColorizer", "GeneratedFieldset", "ListensToObservable", "HasTutorialTip"];
		for (const prop of expected) expect(Object.getOwnPropertyDescriptor(NylasComponentKit.prototype, prop)?.get).toEqual(expect.any(Function));
	});

	it("registers the attachment item during initClass", () => {
		expect(new NylasComponentKit().AttachmentItem).toEqual(expect.objectContaining({ name: "AttachmentItem" }));
	});

	it("registers the image attachment item during initClass", () => {
		expect(new NylasComponentKit().ImageAttachmentItem).toEqual(expect.objectContaining({ name: "ImageAttachmentItem" }));
	});
});
