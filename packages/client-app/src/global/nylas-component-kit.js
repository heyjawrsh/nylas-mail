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
		NylasComponentKit.load("Menu", () => require("../components/menu.jsx"));
		NylasComponentKit.load("DropZone", () =>
			require("../components/drop-zone.jsx"),
		);
		NylasComponentKit.load("Spinner", () =>
			require("../components/spinner.jsx"),
		);
		NylasComponentKit.load("Switch", () => require("../components/switch.jsx"));
		// components/popover.jsx no longer exists; say so instead of failing
		// to resolve a path.
		NylasComponentKit.loadDeprecated(
			"Popover",
			() => {
				throw new Error("Popover was removed; use Actions.openPopover");
			},
			{ instead: "Actions.openPopover" },
		);
		NylasComponentKit.load("FixedPopover", () =>
			require("../components/fixed-popover.jsx"),
		);
		// Under vitest the module-scope eager require of a .jsx component hits the
		// CJS shim (no JSX loader); use the lazy registration there.
		NylasComponentKit.load("DatePickerPopover", () =>
			require("../components/date-picker-popover.jsx"),
		);
		NylasComponentKit.load("Modal", () => require("../components/modal.jsx"));
		NylasComponentKit.load("Webview", () =>
			require("../components/webview.jsx"),
		);
		NylasComponentKit.load("FeatureUsedUpModal", () =>
			require("../components/feature-used-up-modal.jsx"),
		);
		NylasComponentKit.load("BillingModal", () =>
			require("../components/billing-modal.jsx"),
		);
		NylasComponentKit.load("OpenIdentityPageButton", () =>
			require("../components/open-identity-page-button.jsx"),
		);
		NylasComponentKit.load("Flexbox", () =>
			require("../components/flexbox.jsx"),
		);
		NylasComponentKit.load("RetinaImg", () =>
			require("../components/retina-img.jsx"),
		);
		NylasComponentKit.load("SwipeContainer", () =>
			require("../components/swipe-container.jsx"),
		);
		NylasComponentKit.load("FluxContainer", () =>
			require("../components/flux-container.jsx"),
		);
		NylasComponentKit.load("FocusContainer", () =>
			require("../components/focus-container.jsx"),
		);
		NylasComponentKit.load("SyncingListState", () =>
			require("../components/syncing-list-state.jsx"),
		);
		NylasComponentKit.load("EmptyListState", () =>
			require("../components/empty-list-state.jsx"),
		);
		NylasComponentKit.load("ListTabular", () =>
			require("../components/list-tabular.jsx"),
		);
		NylasComponentKit.load("Notification", () =>
			require("../components/notification.jsx"),
		);
		NylasComponentKit.load("NylasCalendar", () =>
			require("../components/nylas-calendar/nylas-calendar.jsx"),
		);
		NylasComponentKit.load("MiniMonthView", () =>
			require("../components/nylas-calendar/mini-month-view.jsx"),
		);
		NylasComponentKit.load("CalendarEventPopover", () =>
			require("../components/nylas-calendar/calendar-event-popover.jsx"),
		);
		NylasComponentKit.load("EventedIFrame", () =>
			require("../components/evented-iframe.jsx"),
		);
		NylasComponentKit.load("ButtonDropdown", () =>
			require("../components/button-dropdown.jsx"),
		);
		NylasComponentKit.load("Contenteditable", () =>
			require("../components/contenteditable/contenteditable.jsx"),
		);
		NylasComponentKit.load("MultiselectList", () =>
			require("../components/multiselect-list.jsx"),
		);
		NylasComponentKit.load("BoldedSearchResult", () =>
			require("../components/bolded-search-result.jsx"),
		);
		NylasComponentKit.load("MultiselectDropdown", () =>
			require("../components/multiselect-dropdown.jsx"),
		);
		NylasComponentKit.load("KeyCommandsRegion", () =>
			require("../components/key-commands-region.jsx"),
		);
		NylasComponentKit.load("TabGroupRegion", () =>
			require("../components/tab-group-region.jsx"),
		);
		NylasComponentKit.load("TabGroupContext", () =>
			require("../components/tab-group-context.js"),
		);
		NylasComponentKit.load("InjectedComponent", () =>
			require("../components/injected-component.jsx"),
		);
		NylasComponentKit.load("TokenizingTextField", () =>
			require("../components/tokenizing-text-field.jsx"),
		);
		NylasComponentKit.load("ParticipantsTextField", () =>
			require("../components/participants-text-field.jsx"),
		);
		NylasComponentKit.loadDeprecated(
			"MultiselectActionBar",
			() => require("../components/multiselect-action-bar.jsx"),
			{ instead: "MultiselectToolbar" },
		);
		NylasComponentKit.load("MultiselectToolbar", () =>
			require("../components/multiselect-toolbar.jsx"),
		);
		NylasComponentKit.load("InjectedComponentSet", () =>
			require("../components/injected-component-set.jsx"),
		);
		NylasComponentKit.load("MetadataComposerToggleButton", () =>
			require("../components/metadata-composer-toggle-button.jsx"),
		);
		NylasComponentKit.load("ConfigPropContainer", () =>
			require("../components/config-prop-container.jsx"),
		);
		NylasComponentKit.load("DisclosureTriangle", () =>
			require("../components/disclosure-triangle.jsx"),
		);
		NylasComponentKit.load("EditableList", () =>
			require("../components/editable-list.jsx"),
		);
		NylasComponentKit.load("OutlineViewItem", () =>
			require("../components/outline-view-item.jsx"),
		);
		NylasComponentKit.load("OutlineView", () =>
			require("../components/outline-view.jsx"),
		);
		NylasComponentKit.load("DateInput", () =>
			require("../components/date-input.jsx"),
		);
		NylasComponentKit.load("DatePicker", () =>
			require("../components/date-picker.jsx"),
		);
		NylasComponentKit.load("TimePicker", () =>
			require("../components/time-picker.jsx"),
		);
		NylasComponentKit.load("Table", () =>
			require("../components/table/table.jsx"),
		);
		NylasComponentKit.loadFrom("TableRow", () =>
			require("../components/table/table.jsx"),
		);
		NylasComponentKit.loadFrom("TableCell", () =>
			require("../components/table/table.jsx"),
		);
		NylasComponentKit.load("SelectableTable", () =>
			require("../components/selectable-table.jsx"),
		);
		NylasComponentKit.loadFrom("SelectableTableRow", () =>
			require("../components/selectable-table.jsx"),
		);
		NylasComponentKit.loadFrom("SelectableTableCell", () =>
			require("../components/selectable-table.jsx"),
		);
		NylasComponentKit.load("EditableTable", () =>
			require("../components/editable-table.jsx"),
		);
		NylasComponentKit.loadFrom("EditableTableCell", () =>
			require("../components/editable-table.jsx"),
		);
		NylasComponentKit.load("Toast", () => require("../components/toast.jsx"));
		NylasComponentKit.load("UndoToast", () =>
			require("../components/undo-toast.jsx"),
		);
		NylasComponentKit.load("LazyRenderedList", () =>
			require("../components/lazy-rendered-list.jsx"),
		);
		NylasComponentKit.load("OverlaidComponents", () =>
			require("../components/overlaid-components/overlaid-components.jsx"),
		);
		NylasComponentKit.load("OverlaidComposerExtension", () =>
			require("../components/overlaid-components/overlaid-composer-extension.js"),
		);
		NylasComponentKit.load("OAuthSignInPage", () =>
			require("../components/oauth-signin-page.jsx"),
		);
		NylasComponentKit.requireFrom("AttachmentItem", () =>
			require("../components/attachment-items.jsx"),
		);
		NylasComponentKit.requireFrom("ImageAttachmentItem", () =>
			require("../components/attachment-items.jsx"),
		);
		NylasComponentKit.load("CodeSnippet", () =>
			require("../components/code-snippet.jsx"),
		);
		NylasComponentKit.load("DropdownMenu", () =>
			require("../components/dropdown-menu.jsx"),
		);

		NylasComponentKit.load("ScrollRegion", () =>
			require("../components/scroll-region.jsx"),
		);
		NylasComponentKit.load("ResizableRegion", () =>
			require("../components/resizable-region.jsx"),
		);

		NylasComponentKit.loadFrom("MailLabel", () =>
			require("../components/mail-label.jsx"),
		);
		NylasComponentKit.loadFrom("LabelColorizer", () =>
			require("../components/mail-label.jsx"),
		);
		NylasComponentKit.load("MailLabelSet", () =>
			require("../components/mail-label-set.jsx"),
		);
		NylasComponentKit.load("MailImportantIcon", () =>
			require("../components/mail-important-icon.jsx"),
		);

		NylasComponentKit.loadFrom("FormItem", () =>
			require("../components/generated-form.jsx"),
		);
		NylasComponentKit.loadFrom("GeneratedForm", () =>
			require("../components/generated-form.jsx"),
		);
		NylasComponentKit.loadFrom("GeneratedFieldset", () =>
			require("../components/generated-form.jsx"),
		);

		NylasComponentKit.load("ScenarioEditor", () =>
			require("../components/scenario-editor.jsx"),
		);

		NylasComponentKit.load("SearchBar", () =>
			require("../components/search-bar.jsx"),
		);

		// Higher order components
		NylasComponentKit.load("ListensToObservable", () =>
			require("../components/decorators/listens-to-observable.jsx"),
		);
		NylasComponentKit.load("ListensToFluxStore", () =>
			require("../components/decorators/listens-to-flux-store.jsx"),
		);
		NylasComponentKit.load("ListensToMovementKeys", () =>
			require("../components/decorators/listens-to-movement-keys.jsx"),
		);
		NylasComponentKit.load("HasTutorialTip", () =>
			require("../components/decorators/has-tutorial-tip.jsx"),
		);
	}

	static default(requireValue) {
		return requireValue.default != null ? requireValue.default : requireValue;
	}

	static load(prop, pathOrThunk) {
		return Object.defineProperty(NylasComponentKit.prototype, prop, {
			get() {
				const mod =
					typeof pathOrThunk === "function"
						? pathOrThunk()
						: requireFromSrc(`../components/${pathOrThunk}`);
				return NylasComponentKit.default(mod);
			},
		});
	}

	// We use require to load the component immediately (instead of lazy loading)
	// to improve visible latency,
	// Sometimes a component won't be loaded until the user performs an action
	// (e.g. opening a popover), so we don't want to wait until that happens to load the
	// component. In our example, the popover would take a long time to open the first time
	// if it was lazy loaded
	static require(prop, pathOrThunk) {
		const exported = NylasComponentKit.default(
			typeof pathOrThunk === "function"
				? pathOrThunk()
				: requireFromSrc(`../components/${pathOrThunk}`),
		);
		return Object.defineProperty(NylasComponentKit.prototype, prop, {
			get() {
				return exported;
			},
		});
	}

	static requireFrom(prop, pathOrThunk) {
		const exported =
			typeof pathOrThunk === "function"
				? pathOrThunk()
				: requireFromSrc(`../components/${pathOrThunk}`);
		return Object.defineProperty(NylasComponentKit.prototype, prop, {
			get() {
				return exported[prop];
			},
		});
	}

	static loadFrom(prop, pathOrThunk) {
		return Object.defineProperty(NylasComponentKit.prototype, prop, {
			get() {
				const exported =
					typeof pathOrThunk === "function"
						? pathOrThunk()
						: requireFromSrc(`../components/${pathOrThunk}`);
				return exported[prop];
			},
		});
	}

	static loadDeprecated(prop, pathOrThunk, param) {
		if (param == null) {
			param = {};
		}
		const { instead } = param;
		const { deprecate } = requireFromSrc("../deprecate-utils.js");
		return Object.defineProperty(NylasComponentKit.prototype, prop, {
			get: deprecate(prop, instead, NylasComponentKit, () => {
				const exported = NylasComponentKit.default(
					typeof pathOrThunk === "function"
						? pathOrThunk()
						: requireFromSrc(`../components/${pathOrThunk}`),
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
// In the renderer bundle, nylas-component-kit-bundle.cjs owns the instance
// (`module` there is the bundle file's own module).
if (
	typeof module !== "undefined" &&
	module.exports &&
	!process.env.VITEST &&
	typeof NYLAS_RENDERER_BUNDLE === "undefined"
) {
	const kitInstance = new NylasComponentKit();
	kitInstance.NylasComponentKit = NylasComponentKit; // class handle for specs
	module.exports = kitInstance;
}
// Dual-context handle: tests reach the class without an ESM export statement
// (any export would flip the module ESM and break the CJS bundle shape).
globalThis.NylasComponentKitClass = NylasComponentKit;
