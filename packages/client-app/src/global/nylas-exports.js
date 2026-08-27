import { createRequire } from "node:module";

const nodeRequire =
	typeof import.meta.url === "string" && import.meta.url.startsWith("file:")
		? createRequire(import.meta.url)
		: require;

/* eslint global-require: 0 */
/* eslint import/no-dynamic-require: 0 */
import TaskRegistry from "../registries/task-registry.js";
import StoreRegistry from "../registries/store-registry.js";
import DatabaseObjectRegistry from "../registries/database-object-registry.js";

const resolveExport = (requireValue) => {
	return requireValue.default || requireValue;
};

// Resolve a path relative to src/ in both module contexts:
// - Node ESM / unbundled: relative to this file (src/global/../x = src/x)
// - Renderer bundle: this file lives in static/, so fall back to the app
//   resource root (loadSettings.resourcePath) + /src/<path>.
const requireFromSrc = (rel) => {
	try {
		return nodeRequire(rel);
	} catch (_e) {
		let root = global.NylasEnv?.getResourcePath?.();
		if (!root && typeof document !== "undefined") {
			// Bundled context: this file executes from <root>/static/, so the
			// app root is the parent of the current document's directory.
			const here = new URL(".", document.baseURI).pathname;
			root = here.replace(/\/$/, "").replace(/\/static$/, "");
		}
		const stripped = rel.replace(/^(?:\.\.\/)+/, "");
		return nodeRequire(`${root}/src/${stripped}`);
	}
};

// This module exports an empty object, with a ton of defined properties that
// `require` files the first time they're called.
// Works under CJS (electron main, nodeRequire chains) and ESM (vitest/vite):
// anchor the bridge object on the window/global and re-export both ways.
const $n = (window.$n = globalThis.$n = {});
if (typeof module !== "undefined" && module.exports && !process.env.VITEST) {
	// CJS contexts (electron main, nodeRequire chains). Under vitest the
	// injected `module.exports` is a getter-only namespace — skip.
	module.exports = exports = $n;
}

// Calling require() repeatedly isn't free! Even though it has it's own cache,
// it still needs to resolve the path to a file based on the current __dirname,
// match it against it's cache, etc. We can shortcut all this work.
const RequireCache = {};

// Will lazy load when requested
const lazyLoadWithGetter = (prop, getter) => {
	const key = `${prop}`;

	if ($n[key]) {
		throw new Error(`Fatal error: Duplicate entry in nylas-exports: ${key}`);
	}
	Object.defineProperty($n, prop, {
		get: () => {
			RequireCache[key] = RequireCache[key] || getter();
			return RequireCache[key];
		},
		enumerable: true,
	});
};

const lazyLoad = (prop, path) => {
	lazyLoadWithGetter(prop, () => resolveExport(requireFromSrc(`../${path}`)));
};

const lazyLoadAndRegisterStore = (klassName, path) => {
	lazyLoad(klassName, `flux/stores/${path}`);
	StoreRegistry.register(klassName, () => $n[klassName]);
};

const lazyLoadAndRegisterModel = (klassName, path) => {
	lazyLoad(klassName, `flux/models/${path}`);
	DatabaseObjectRegistry.register(klassName, () => $n[klassName]);
};

const lazyLoadAndRegisterTask = (klassName, path) => {
	lazyLoad(klassName, `flux/tasks/${path}`);
	TaskRegistry.register(klassName, () => $n[klassName]);
};

const lazyLoadDeprecated = (prop, path, { instead } = {}) => {
	const { deprecate } = requireFromSrc("../deprecate-utils.js");
	Object.defineProperty($n, prop, {
		get: deprecate(prop, instead, $n, () => {
			return resolveExport(requireFromSrc(`../${path}`));
		}),
		enumerable: true,
	});
};

// Actions
lazyLoad(`Actions`, "flux/actions");

// API Endpoints
lazyLoad(`NylasAPI`, "flux/nylas-api");
lazyLoad(`N1CloudAPI`, "n1-cloud-api");
lazyLoad(`NylasAPIHelpers`, "flux/nylas-api-helpers");
lazyLoad(`NylasAPIRequest`, "flux/nylas-api-request");
lazyLoad(`NylasLongConnection`, "flux/nylas-long-connection");

// The Database
lazyLoad(`Matcher`, "flux/attributes/matcher");
lazyLoad(`DatabaseStore`, "flux/stores/database-store");
lazyLoad(`QueryResultSet`, "flux/models/query-result-set");
lazyLoad(`QuerySubscription`, "flux/models/query-subscription");
lazyLoad(
	`CalendarDataSource`,
	"components/nylas-calendar/calendar-data-source",
);
lazyLoad(`DatabaseWriter`, "flux/stores/database-writer");
lazyLoad(`MutableQueryResultSet`, "flux/models/mutable-query-result-set");
lazyLoad(`QuerySubscriptionPool`, "flux/models/query-subscription-pool");
lazyLoad(`ObservableListDataSource`, "flux/stores/observable-list-data-source");
lazyLoad(`MutableQuerySubscription`, "flux/models/mutable-query-subscription");

// Database Objects
$n.DatabaseObjectRegistry = DatabaseObjectRegistry;
lazyLoad(`Model`, "flux/models/model");
lazyLoad(`Attributes`, "flux/attributes");
lazyLoadAndRegisterModel(`File`, "file");
lazyLoadAndRegisterModel(`Event`, "event");
lazyLoadAndRegisterModel(`Label`, "label");
lazyLoadAndRegisterModel(`Folder`, "folder");
lazyLoadAndRegisterModel(`Thread`, "thread");
lazyLoadAndRegisterModel(`Account`, "account");
lazyLoadAndRegisterModel(`Message`, "message");
lazyLoadAndRegisterModel(`Contact`, "contact");
lazyLoadAndRegisterModel(`Category`, "category");
lazyLoadAndRegisterModel(`Calendar`, "calendar");
lazyLoadAndRegisterModel(`JSONBlob`, "json-blob");
lazyLoadAndRegisterModel(
	`ProviderSyncbackRequest`,
	"provider-syncback-request",
);

// Search Query Interfaces
lazyLoad(`SearchQueryAST`, "services/search/search-query-ast");
lazyLoad(`SearchQueryParser`, "services/search/search-query-parser");
lazyLoad(`IMAPSearchQueryBackend`, "services/search/search-query-backend-imap");

// Tasks
$n.TaskRegistry = TaskRegistry;
lazyLoad(`Task`, "flux/tasks/task");
lazyLoad(`TaskFactory`, "flux/tasks/task-factory");
lazyLoadAndRegisterTask(`EventRSVPTask`, "event-rsvp-task");
lazyLoadAndRegisterTask(`BaseDraftTask`, "base-draft-task");
lazyLoadAndRegisterTask(`SendDraftTask`, "send-draft-task");
lazyLoadAndRegisterTask(`ChangeMailTask`, "change-mail-task");
lazyLoadAndRegisterTask(`DestroyDraftTask`, "destroy-draft-task");
lazyLoadAndRegisterTask(`ChangeLabelsTask`, "change-labels-task");
lazyLoadAndRegisterTask(`ChangeFolderTask`, "change-folder-task");
lazyLoadAndRegisterTask(`ChangeUnreadTask`, "change-unread-task");
lazyLoadAndRegisterTask(`DestroyModelTask`, "destroy-model-task");
lazyLoadAndRegisterTask(`ChangeStarredTask`, "change-starred-task");
lazyLoadAndRegisterTask(`SyncbackModelTask`, "syncback-model-task");
lazyLoadAndRegisterTask(`SyncbackEventTask`, "syncback-event-task");
lazyLoadAndRegisterTask(`DestroyCategoryTask`, "destroy-category-task");
lazyLoadAndRegisterTask(`SyncbackCategoryTask`, "syncback-category-task");
lazyLoadAndRegisterTask(`SyncbackMetadataTask`, "syncback-metadata-task");
lazyLoadAndRegisterTask(`PerformSendActionTask`, "perform-send-action-task");
lazyLoadAndRegisterTask(`ReprocessMailRulesTask`, "reprocess-mail-rules-task");
lazyLoadAndRegisterTask(
	`SendFeatureUsageEventTask`,
	"send-feature-usage-event-task",
);
lazyLoadAndRegisterTask(
	`EnsureMessageInSentFolderTask`,
	"ensure-message-in-sent-folder-task",
);

// Stores
// These need to be required immediately since some Stores are
// listen-only and not explicitly required from anywhere. Stores
// currently set themselves up on require.
lazyLoadAndRegisterStore(`TaskQueue`, "task-queue");
lazyLoadAndRegisterStore(`BadgeStore`, "badge-store");
lazyLoadAndRegisterStore(`DraftStore`, "draft-store");
lazyLoadAndRegisterStore(`ModalStore`, "modal-store");
lazyLoadAndRegisterStore(`OutboxStore`, "outbox-store");
lazyLoadAndRegisterStore(`PopoverStore`, "popover-store");
lazyLoadAndRegisterStore(`AccountStore`, "account-store");
lazyLoadAndRegisterStore(`SignatureStore`, "signature-store");
lazyLoadAndRegisterStore(`MessageStore`, "message-store");
lazyLoadAndRegisterStore(`ContactStore`, "contact-store");
lazyLoadAndRegisterStore(`IdentityStore`, "identity-store");
lazyLoadAndRegisterStore(`MetadataStore`, "metadata-store");
lazyLoadAndRegisterStore(`CategoryStore`, "category-store");
lazyLoadAndRegisterStore(`UndoRedoStore`, "undo-redo-store");
lazyLoadAndRegisterStore(`WorkspaceStore`, "workspace-store");
lazyLoadAndRegisterStore(`MailRulesStore`, "mail-rules-store");
lazyLoadAndRegisterStore(`FileUploadStore`, "file-upload-store");
lazyLoadAndRegisterStore(`SendActionsStore`, "send-actions-store");
lazyLoadAndRegisterStore(`FeatureUsageStore`, "feature-usage-store");
lazyLoadAndRegisterStore(`ThreadCountsStore`, "thread-counts-store");
lazyLoadAndRegisterStore(`FileDownloadStore`, "file-download-store");
lazyLoadAndRegisterStore(`OnlineStatusStore`, "online-status-store");
lazyLoadAndRegisterStore(`PreferencesUIStore`, "preferences-ui-store");
lazyLoadAndRegisterStore(`FocusedContentStore`, "focused-content-store");
lazyLoadAndRegisterStore(`MessageBodyProcessor`, "message-body-processor");
lazyLoadAndRegisterStore(`FocusedContactsStore`, "focused-contacts-store");
lazyLoadAndRegisterStore(`DeltaConnectionStore`, "delta-connection-store");
lazyLoadAndRegisterStore(`TaskQueueStatusStore`, "task-queue-status-store");
lazyLoadAndRegisterStore(
	`FolderSyncProgressStore`,
	"folder-sync-progress-store",
);
lazyLoadAndRegisterStore(`ThreadListActionsStore`, "thread-list-actions-store");
lazyLoadAndRegisterStore(
	`FocusedPerspectiveStore`,
	"focused-perspective-store",
);
lazyLoadAndRegisterStore(
	`SearchableComponentStore`,
	"searchable-component-store",
);
lazyLoad(
	`CustomContenteditableComponents`,
	"components/overlaid-components/custom-contenteditable-components",
);

lazyLoad(`ServiceRegistry`, `registries/service-registry`);

// Decorators
lazyLoad(`InflatesDraftClientId`, "decorators/inflates-draft-client-id");

// Extensions
lazyLoad(`ExtensionRegistry`, "registries/extension-registry");
lazyLoad(`ComposerExtension`, "extensions/composer-extension");
lazyLoad(`MessageViewExtension`, "extensions/message-view-extension");
lazyLoad(`ContenteditableExtension`, "extensions/contenteditable-extension");

// 3rd party libraries
lazyLoadWithGetter(`Rx`, () => nodeRequire("rxjs"));
lazyLoadWithGetter(`React`, () => nodeRequire("react"));
lazyLoadWithGetter(`Reflux`, () => nodeRequire("reflux"));
lazyLoadWithGetter(`ReactDOM`, () => nodeRequire("react-dom"));
lazyLoadWithGetter(`ReactTestUtils`, () => nodeRequire("react-dom/test-utils"));

// React Components
lazyLoad(`ComponentRegistry`, "registries/component-registry");
lazyLoad(`PriorityUICoordinator`, "priority-ui-coordinator");

// Utils
lazyLoad(`Utils`, "flux/models/utils");
lazyLoad(`DOMUtils`, "dom-utils");
lazyLoad(`DateUtils`, "date-utils");
lazyLoad(`FsUtils`, "fs-utils");
lazyLoad(`CanvasUtils`, "canvas-utils");
lazyLoad(`RegExpUtils`, "regexp-utils");
lazyLoad(`MenuHelpers`, "menu-helpers");
lazyLoad(`DeprecateUtils`, "deprecate-utils");
lazyLoad(`VirtualDOMUtils`, "virtual-dom-utils");
lazyLoad(`Spellchecker`, "spellchecker");
lazyLoad(`DraftHelpers`, "flux/stores/draft-helpers");
lazyLoad(`MessageUtils`, "flux/models/message-utils");
lazyLoad(`EditorAPI`, "components/contenteditable/editor-api");

// Services
lazyLoad(`KeyManager`, "key-manager");
lazyLoad(`SoundRegistry`, "registries/sound-registry");
lazyLoad(`MailRulesTemplates`, "mail-rules-templates");
lazyLoad(`MailRulesProcessor`, "mail-rules-processor");
lazyLoad(`MailboxPerspective`, "mailbox-perspective");
lazyLoad(`DeltaProcessor`, "services/delta-processor");
lazyLoad(`NativeNotifications`, "native-notifications");
lazyLoad(`ModelSearchIndexer`, "services/model-search-indexer");
lazyLoad(`SearchIndexScheduler`, "services/search-index-scheduler");
lazyLoad(`SanitizeTransformer`, "services/sanitize-transformer");
lazyLoad(`QuotedHTMLTransformer`, "services/quoted-html-transformer");
lazyLoad(`InlineStyleTransformer`, "services/inline-style-transformer");
lazyLoad(
	`SearchableComponentMaker`,
	"searchable-components/searchable-component-maker",
);
lazyLoad(
	`QuotedPlainTextTransformer`,
	"services/quoted-plain-text-transformer",
);
lazyLoad(`BatteryStatusManager`, "services/battery-status-manager");

// Errors
lazyLoadWithGetter(`APIError`, () => nodeRequire("../flux/errors.js").APIError);

// Process Internals
lazyLoad(`DefaultClientHelper`, "default-client-helper");
lazyLoad(`BufferedProcess`, "buffered-process");
lazyLoad(`SystemStartService`, "system-start-service");
lazyLoadWithGetter(`APMWrapper`, () => nodeRequire("../apm-wrapper.js"));

// Testing
lazyLoadWithGetter(`NylasTestUtils`, () =>
	nodeRequire("../../spec/nylas-test-utils.js"),
);

// Deprecated
lazyLoadDeprecated(`QuotedHTMLParser`, "services/quoted-html-transformer", {
	instead: "QuotedHTMLTransformer",
});
lazyLoadDeprecated(`DraftStoreExtension`, "flux/stores/draft-store-extension", {
	instead: "ComposerExtension",
});
lazyLoadDeprecated(
	`MessageStoreExtension`,
	"flux/stores/message-store-extension",
	{
		instead: "MessageViewExtension",
	},
);

// ESM surface: named imports from this module resolve eagerly through the
// lazy getters (safe against the app's intentional model<->store cycles).
export default $n;
// Named exports are lazy proxies: the bridge getters load real modules on
// first ACCESS (post-cycle). Eager reads — even guarded — fire every getter
// at module-eval time and re-enter the intentional model<->store cycles.
const __lazy = (name) =>
	new Proxy(function lazyBridge() {}, {
		get(_t, prop) {
			const real = $n[name];
			if (real === undefined || real === null) return real;
			const v = real[prop];
			return typeof v === "function" ? v.bind(real) : v;
		},
		apply(_t, _thisArg, args) {
			return $n[name](...args);
		},
		construct(_t, args, newTarget) {
			return Reflect.construct($n[name], args, newTarget);
		},
		has(_t, prop) {
			return prop in ($n[name] || {});
		},
	});
export const APIError = __lazy("APIError");
export const APMWrapper = __lazy("APMWrapper");
export const Account = __lazy("Account");
export const AccountStore = __lazy("AccountStore");
export const Actions = __lazy("Actions");
export const Attributes = __lazy("Attributes");
export const BadgeStore = __lazy("BadgeStore");
export const BaseDraftTask = __lazy("BaseDraftTask");
export const Calendar = __lazy("Calendar");
export const CalendarDataSource = __lazy("CalendarDataSource");
export const Category = __lazy("Category");
export const CategoryStore = __lazy("CategoryStore");
export const ComponentRegistry = __lazy("ComponentRegistry");
export const ComposerExtension = __lazy("ComposerExtension");
export const Contact = __lazy("Contact");
export const ContactStore = __lazy("ContactStore");
export const ContenteditableExtension = __lazy("ContenteditableExtension");
export const CustomContenteditableComponents = __lazy(
	"CustomContenteditableComponents",
);
export const DOMUtils = __lazy("DOMUtils");
export const DatabaseStore = __lazy("DatabaseStore");
export const DateUtils = __lazy("DateUtils");
export const DefaultClientHelper = __lazy("DefaultClientHelper");
export const DestroyModelTask = __lazy("DestroyModelTask");
export const DraftHelpers = __lazy("DraftHelpers");
export const DraftStore = __lazy("DraftStore");
export const EditorAPI = __lazy("EditorAPI");
export const Event = __lazy("Event");
export const ExtensionRegistry = __lazy("ExtensionRegistry");
export const FeatureUsageStore = __lazy("FeatureUsageStore");
export const FileDownloadStore = __lazy("FileDownloadStore");
export const FocusedContactsStore = __lazy("FocusedContactsStore");
export const FocusedContentStore = __lazy("FocusedContentStore");
export const FocusedPerspectiveStore = __lazy("FocusedPerspectiveStore");
export const FolderSyncProgressStore = __lazy("FolderSyncProgressStore");
export const IdentityStore = __lazy("IdentityStore");
export const InflatesDraftClientId = __lazy("InflatesDraftClientId");
export const InlineStyleTransformer = __lazy("InlineStyleTransformer");
export const KeyManager = __lazy("KeyManager");
export const MailRulesStore = __lazy("MailRulesStore");
export const MailRulesTemplates = __lazy("MailRulesTemplates");
export const MailboxPerspective = __lazy("MailboxPerspective");
export const Matcher = __lazy("Matcher");
export const Message = __lazy("Message");
export const MessageBodyProcessor = __lazy("MessageBodyProcessor");
export const MessageStore = __lazy("MessageStore");
export const MessageViewExtension = __lazy("MessageViewExtension");
export const Model = __lazy("Model");
export const ModelSearchIndexer = __lazy("ModelSearchIndexer");
export const MutableQuerySubscription = __lazy("MutableQuerySubscription");
export const N1CloudAPI = __lazy("N1CloudAPI");
export const NativeNotifications = __lazy("NativeNotifications");
export const NylasAPI = __lazy("NylasAPI");
export const NylasAPIHelpers = __lazy("NylasAPIHelpers");
export const NylasAPIRequest = __lazy("NylasAPIRequest");
export const NylasLongConnection = __lazy("NylasLongConnection");
export const NylasTestUtils = __lazy("NylasTestUtils");
export const ObservableListDataSource = __lazy("ObservableListDataSource");
export const OnlineStatusStore = __lazy("OnlineStatusStore");
export const PreferencesUIStore = __lazy("PreferencesUIStore");
export const QueryResultSet = __lazy("QueryResultSet");
export const QuerySubscription = __lazy("QuerySubscription");
export const QuotedHTMLTransformer = __lazy("QuotedHTMLTransformer");
export const React = __lazy("React");
export const ReactDOM = __lazy("ReactDOM");
export const Reflux = __lazy("Reflux");
export const RegExpUtils = __lazy("RegExpUtils");
export const ReprocessMailRulesTask = __lazy("ReprocessMailRulesTask");
export const Rx = __lazy("Rx");
export const SanitizeTransformer = __lazy("SanitizeTransformer");
export const SearchIndexScheduler = __lazy("SearchIndexScheduler");
export const SearchQueryParser = __lazy("SearchQueryParser");
export const SearchableComponentStore = __lazy("SearchableComponentStore");
export const SendActionsStore = __lazy("SendActionsStore");
export const SendDraftTask = __lazy("SendDraftTask");
export const SignatureStore = __lazy("SignatureStore");
export const SoundRegistry = __lazy("SoundRegistry");
export const Spellchecker = __lazy("Spellchecker");
export const SyncbackCategoryTask = __lazy("SyncbackCategoryTask");
export const SyncbackEventTask = __lazy("SyncbackEventTask");
export const SyncbackMetadataTask = __lazy("SyncbackMetadataTask");
export const SystemStartService = __lazy("SystemStartService");
export const Task = __lazy("Task");
export const TaskFactory = __lazy("TaskFactory");
export const TaskQueue = __lazy("TaskQueue");
export const TaskQueueStatusStore = __lazy("TaskQueueStatusStore");
export const Thread = __lazy("Thread");
export const UndoRedoStore = __lazy("UndoRedoStore");
export const Utils = __lazy("Utils");
export const VirtualDOMUtils = __lazy("VirtualDOMUtils");
export const WorkspaceStore = __lazy("WorkspaceStore");
