import { createRequire } from "node:module";

const nodeRequire =
	typeof import.meta.url === "string" && import.meta.url.startsWith("file:")
		? createRequire(import.meta.url)
		: require;

const jsxModuleCache = new Map();
const loadJsxManually = (absPath) => {
	// Node ESM-detects .jsx files containing import/export and parses them
	// with the ESM loader — which cannot parse JSX and ignores CJS extension
	// hooks. Compile to CJS ourselves (the inline compile-cache successor)
	// and evaluate in a fresh module scope.
	if (jsxModuleCache.has(absPath)) {
		return jsxModuleCache.get(absPath).exports;
	}
	const fs = nodeRequire("fs");
	const { transformSync } = nodeRequire("esbuild");
	const { Module } = nodeRequire("module");
	const code = transformSync(fs.readFileSync(absPath, "utf8"), {
		loader: "jsx",
		format: "cjs",
	}).code;
	const mod = new Module(absPath, null);
	mod.filename = absPath;
	mod.paths = Module._nodeModulePaths(
		absPath.slice(0, absPath.lastIndexOf("/")),
	);
	jsxModuleCache.set(absPath, mod);
	mod._compile(code, absPath);
	return mod.exports;
};

const requireFromSrc = (rel) => {
	// Infer .js/.jsx for extensionless component names (the lazy maps use
	// bare names).
	const withExt = (p0) => {
		if (/\.(js|jsx|json)$/.test(p0)) return p0;
		try {
			nodeRequire.resolve(`${p0}.js`);
			return `${p0}.js`;
		} catch (_e) {
			return `${p0}.jsx`;
		}
	};
	const resolved = withExt(rel);
	if (resolved.endsWith(".jsx")) {
		const abs = nodeRequire.resolve(resolved);
		return loadJsxManually(abs);
	}
	try {
		return nodeRequire(resolved);
	} catch (_e) {
		let root = global.NylasEnv?.getResourcePath?.();
		if (!root && typeof document !== "undefined") {
			const here = new URL(".", document.baseURI).pathname;
			root = here.replace(/\/$/, "").replace(/\/static$/, "");
		}
		const stripped = resolved.replace(/^(?:\.\.\/)+/, "");
		const abs2 = `${root}/src/${stripped}`;
		if (abs2.endsWith(".jsx")) {
			return loadJsxManually(abs2);
		}
		return require(abs2);
	}
}; /*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
// Publically exposed Nylas UI Components
class NylasComponentKit {
	static initClass() {
		NylasComponentKit.load("Menu", "menu");
		NylasComponentKit.load("DropZone", "drop-zone");
		NylasComponentKit.load("Spinner", "spinner");
		NylasComponentKit.load("Switch", "switch");
		NylasComponentKit.loadDeprecated("Popover", "popover", {
			instead: "Actions.openPopover",
		});
		NylasComponentKit.load("FixedPopover", "fixed-popover");
		// Under vitest the module-scope eager require of a .jsx component hits the
		// CJS shim (no JSX loader); use the lazy registration there.
		NylasComponentKit.load("DatePickerPopover", "date-picker-popover");
		NylasComponentKit.load("Modal", "modal");
		NylasComponentKit.load("Webview", "webview");
		NylasComponentKit.load("FeatureUsedUpModal", "feature-used-up-modal");
		NylasComponentKit.load("BillingModal", "billing-modal");
		NylasComponentKit.load(
			"OpenIdentityPageButton",
			"open-identity-page-button",
		);
		NylasComponentKit.load("Flexbox", "flexbox");
		NylasComponentKit.load("RetinaImg", "retina-img");
		NylasComponentKit.load("SwipeContainer", "swipe-container");
		NylasComponentKit.load("FluxContainer", "flux-container");
		NylasComponentKit.load("FocusContainer", "focus-container");
		NylasComponentKit.load("SyncingListState", "syncing-list-state");
		NylasComponentKit.load("EmptyListState", "empty-list-state");
		NylasComponentKit.load("ListTabular", "list-tabular");
		NylasComponentKit.load("Notification", "notification");
		NylasComponentKit.load("NylasCalendar", "nylas-calendar/nylas-calendar");
		NylasComponentKit.load("MiniMonthView", "nylas-calendar/mini-month-view");
		NylasComponentKit.load(
			"CalendarEventPopover",
			"nylas-calendar/calendar-event-popover",
		);
		NylasComponentKit.load("EventedIFrame", "evented-iframe");
		NylasComponentKit.load("ButtonDropdown", "button-dropdown");
		NylasComponentKit.load(
			"Contenteditable",
			"contenteditable/contenteditable",
		);
		NylasComponentKit.load("MultiselectList", "multiselect-list");
		NylasComponentKit.load("BoldedSearchResult", "bolded-search-result");
		NylasComponentKit.load("MultiselectDropdown", "multiselect-dropdown");
		NylasComponentKit.load("KeyCommandsRegion", "key-commands-region");
		NylasComponentKit.load("TabGroupRegion", "tab-group-region");
		NylasComponentKit.load("InjectedComponent", "injected-component");
		NylasComponentKit.load("TokenizingTextField", "tokenizing-text-field");
		NylasComponentKit.load("ParticipantsTextField", "participants-text-field");
		NylasComponentKit.loadDeprecated(
			"MultiselectActionBar",
			"multiselect-action-bar",
			{ instead: "MultiselectToolbar" },
		);
		NylasComponentKit.load("MultiselectToolbar", "multiselect-toolbar");
		NylasComponentKit.load("InjectedComponentSet", "injected-component-set");
		NylasComponentKit.load(
			"MetadataComposerToggleButton",
			"metadata-composer-toggle-button",
		);
		NylasComponentKit.load("ConfigPropContainer", "config-prop-container");
		NylasComponentKit.load("DisclosureTriangle", "disclosure-triangle");
		NylasComponentKit.load("EditableList", "editable-list");
		NylasComponentKit.load("OutlineViewItem", "outline-view-item");
		NylasComponentKit.load("OutlineView", "outline-view");
		NylasComponentKit.load("DateInput", "date-input");
		NylasComponentKit.load("DatePicker", "date-picker");
		NylasComponentKit.load("TimePicker", "time-picker");
		NylasComponentKit.load("Table", "table/table");
		NylasComponentKit.loadFrom("TableRow", "table/table");
		NylasComponentKit.loadFrom("TableCell", "table/table");
		NylasComponentKit.load("SelectableTable", "selectable-table");
		NylasComponentKit.loadFrom("SelectableTableRow", "selectable-table");
		NylasComponentKit.loadFrom("SelectableTableCell", "selectable-table");
		NylasComponentKit.load("EditableTable", "editable-table");
		NylasComponentKit.loadFrom("EditableTableCell", "editable-table");
		NylasComponentKit.load("Toast", "toast");
		NylasComponentKit.load("UndoToast", "undo-toast");
		NylasComponentKit.load("LazyRenderedList", "lazy-rendered-list");
		NylasComponentKit.load(
			"OverlaidComponents",
			"overlaid-components/overlaid-components",
		);
		NylasComponentKit.load(
			"OverlaidComposerExtension",
			"overlaid-components/overlaid-composer-extension",
		);
		NylasComponentKit.load("OAuthSignInPage", "oauth-signin-page");
		NylasComponentKit.requireFrom("AttachmentItem", "attachment-items");
		NylasComponentKit.requireFrom("ImageAttachmentItem", "attachment-items");
		NylasComponentKit.load("CodeSnippet", "code-snippet");
		NylasComponentKit.load("DropdownMenu", "dropdown-menu");

		NylasComponentKit.load("ScrollRegion", "scroll-region");
		NylasComponentKit.load("ResizableRegion", "resizable-region");

		NylasComponentKit.loadFrom("MailLabel", "mail-label");
		NylasComponentKit.loadFrom("LabelColorizer", "mail-label");
		NylasComponentKit.load("MailLabelSet", "mail-label-set");
		NylasComponentKit.load("MailImportantIcon", "mail-important-icon");

		NylasComponentKit.loadFrom("FormItem", "generated-form");
		NylasComponentKit.loadFrom("GeneratedForm", "generated-form");
		NylasComponentKit.loadFrom("GeneratedFieldset", "generated-form");

		NylasComponentKit.load("ScenarioEditor", "scenario-editor");

		NylasComponentKit.load("SearchBar", "search-bar");

		// Higher order components
		NylasComponentKit.load(
			"ListensToObservable",
			"decorators/listens-to-observable",
		);
		NylasComponentKit.load(
			"ListensToFluxStore",
			"decorators/listens-to-flux-store",
		);
		NylasComponentKit.load(
			"ListensToMovementKeys",
			"decorators/listens-to-movement-keys",
		);
		NylasComponentKit.load("HasTutorialTip", "decorators/has-tutorial-tip");
	}

	static default(requireValue) {
		return requireValue.default != null ? requireValue.default : requireValue;
	}

	static load(prop, path) {
		return Object.defineProperty(NylasComponentKit.prototype, prop, {
			get() {
				return NylasComponentKit.default(
					requireFromSrc(`../components/${path}`),
				);
			},
		});
	}

	// We use require to load the component immediately (instead of lazy loading)
	// to improve visible latency,
	// Sometimes a component won't be loaded until the user performs an action
	// (e.g. opening a popover), so we don't want to wait until that happens to load the
	// component. In our example, the popover would take a long time to open the first time
	// if it was lazy loaded
	static require(prop, path) {
		const exported = NylasComponentKit.default(
			requireFromSrc(`../components/${path}`),
		);
		return Object.defineProperty(NylasComponentKit.prototype, prop, {
			get() {
				return exported;
			},
		});
	}

	static requireFrom(prop, path) {
		const exported = requireFromSrc(`../components/${path}`);
		return Object.defineProperty(NylasComponentKit.prototype, prop, {
			get() {
				return exported[prop];
			},
		});
	}

	static loadFrom(prop, path) {
		return Object.defineProperty(NylasComponentKit.prototype, prop, {
			get() {
				const exported = requireFromSrc(`../components/${path}`);
				return exported[prop];
			},
		});
	}

	static loadDeprecated(prop, path, param) {
		if (param == null) {
			param = {};
		}
		const { instead } = param;
		const { deprecate } = requireFromSrc("../deprecate-utils.js");
		return Object.defineProperty(NylasComponentKit.prototype, prop, {
			get: deprecate(prop, instead, NylasComponentKit, () => {
				const exported = NylasComponentKit.default(
					requireFromSrc(`../components/${path}`),
				);
				return exported;
			}),
			enumerable: true,
		});
	}
}
try {
	// Under vitest the registration pass eagerly resolves component modules
	// through contexts without a JSX loader; tests import components directly,
	// so skip the pass there.
	if (!process.env.VITEST) {
		NylasComponentKit.initClass();
	}
} catch (e) {
	console.error(
		"KIT_INITCLASS_FAIL:",
		e.message,
		e.stack?.split("\n").slice(1, 4).join(" | "),
	);
	throw e;
}

// The eager instance makes vite's CJS interop walk every prototype getter at
// module-eval time (loading .jsx components through the CJS shim, which has
// no JSX loader). Under vitest, export the class; consumers instantiate.
module.exports = new NylasComponentKit();
