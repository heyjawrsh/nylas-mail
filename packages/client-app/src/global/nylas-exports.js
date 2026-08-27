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
if (typeof module !== "undefined" && module.exports) {
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
lazyLoadWithGetter(`Rx`, () => require("rxjs"));
lazyLoadWithGetter(`React`, () => require("react"));
lazyLoadWithGetter(`Reflux`, () => require("reflux"));
lazyLoadWithGetter(`ReactDOM`, () => require("react-dom"));
lazyLoadWithGetter(`ReactTestUtils`, () => require("react-dom/test-utils"));

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
lazyLoadWithGetter(`APIError`, () => require("../flux/errors.js").APIError);

// Process Internals
lazyLoad(`DefaultClientHelper`, "default-client-helper");
lazyLoad(`BufferedProcess`, "buffered-process");
lazyLoad(`SystemStartService`, "system-start-service");
lazyLoadWithGetter(`APMWrapper`, () => require("../apm-wrapper.js"));

// Testing
lazyLoadWithGetter(`NylasTestUtils`, () =>
	require("../../spec/nylas-test-utils.js"),
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
export const APIError =
	typeof $n.APIError !== "undefined" ? $n.APIError : undefined;
export const APMWrapper =
	typeof $n.APMWrapper !== "undefined" ? $n.APMWrapper : undefined;
export const Account =
	typeof $n.Account !== "undefined" ? $n.Account : undefined;
export const AccountStore =
	typeof $n.AccountStore !== "undefined" ? $n.AccountStore : undefined;
export const Actions =
	typeof $n.Actions !== "undefined" ? $n.Actions : undefined;
export const Attributes =
	typeof $n.Attributes !== "undefined" ? $n.Attributes : undefined;
export const BadgeStore =
	typeof $n.BadgeStore !== "undefined" ? $n.BadgeStore : undefined;
export const BaseDraftTask =
	typeof $n.BaseDraftTask !== "undefined" ? $n.BaseDraftTask : undefined;
export const Calendar =
	typeof $n.Calendar !== "undefined" ? $n.Calendar : undefined;
export const CalendarDataSource =
	typeof $n.CalendarDataSource !== "undefined"
		? $n.CalendarDataSource
		: undefined;
export const Category =
	typeof $n.Category !== "undefined" ? $n.Category : undefined;
export const CategoryStore =
	typeof $n.CategoryStore !== "undefined" ? $n.CategoryStore : undefined;
export const ComponentRegistry =
	typeof $n.ComponentRegistry !== "undefined"
		? $n.ComponentRegistry
		: undefined;
export const ComposerExtension =
	typeof $n.ComposerExtension !== "undefined"
		? $n.ComposerExtension
		: undefined;
export const Contact =
	typeof $n.Contact !== "undefined" ? $n.Contact : undefined;
export const ContactStore =
	typeof $n.ContactStore !== "undefined" ? $n.ContactStore : undefined;
export const ContenteditableExtension =
	typeof $n.ContenteditableExtension !== "undefined"
		? $n.ContenteditableExtension
		: undefined;
export const CustomContenteditableComponents =
	typeof $n.CustomContenteditableComponents !== "undefined"
		? $n.CustomContenteditableComponents
		: undefined;
export const DOMUtils =
	typeof $n.DOMUtils !== "undefined" ? $n.DOMUtils : undefined;
export const DatabaseStore =
	typeof $n.DatabaseStore !== "undefined" ? $n.DatabaseStore : undefined;
export const DateUtils =
	typeof $n.DateUtils !== "undefined" ? $n.DateUtils : undefined;
export const DefaultClientHelper =
	typeof $n.DefaultClientHelper !== "undefined"
		? $n.DefaultClientHelper
		: undefined;
export const DestroyModelTask =
	typeof $n.DestroyModelTask !== "undefined" ? $n.DestroyModelTask : undefined;
export const DraftHelpers =
	typeof $n.DraftHelpers !== "undefined" ? $n.DraftHelpers : undefined;
export const DraftStore =
	typeof $n.DraftStore !== "undefined" ? $n.DraftStore : undefined;
export const EditorAPI =
	typeof $n.EditorAPI !== "undefined" ? $n.EditorAPI : undefined;
export const Event = typeof $n.Event !== "undefined" ? $n.Event : undefined;
export const ExtensionRegistry =
	typeof $n.ExtensionRegistry !== "undefined"
		? $n.ExtensionRegistry
		: undefined;
export const FeatureUsageStore =
	typeof $n.FeatureUsageStore !== "undefined"
		? $n.FeatureUsageStore
		: undefined;
export const FileDownloadStore =
	typeof $n.FileDownloadStore !== "undefined"
		? $n.FileDownloadStore
		: undefined;
export const FocusedContactsStore =
	typeof $n.FocusedContactsStore !== "undefined"
		? $n.FocusedContactsStore
		: undefined;
export const FocusedContentStore =
	typeof $n.FocusedContentStore !== "undefined"
		? $n.FocusedContentStore
		: undefined;
export const FocusedPerspectiveStore =
	typeof $n.FocusedPerspectiveStore !== "undefined"
		? $n.FocusedPerspectiveStore
		: undefined;
export const FolderSyncProgressStore =
	typeof $n.FolderSyncProgressStore !== "undefined"
		? $n.FolderSyncProgressStore
		: undefined;
export const IdentityStore =
	typeof $n.IdentityStore !== "undefined" ? $n.IdentityStore : undefined;
export const InflatesDraftClientId =
	typeof $n.InflatesDraftClientId !== "undefined"
		? $n.InflatesDraftClientId
		: undefined;
export const InlineStyleTransformer =
	typeof $n.InlineStyleTransformer !== "undefined"
		? $n.InlineStyleTransformer
		: undefined;
export const KeyManager =
	typeof $n.KeyManager !== "undefined" ? $n.KeyManager : undefined;
export const MailRulesStore =
	typeof $n.MailRulesStore !== "undefined" ? $n.MailRulesStore : undefined;
export const MailRulesTemplates =
	typeof $n.MailRulesTemplates !== "undefined"
		? $n.MailRulesTemplates
		: undefined;
export const MailboxPerspective =
	typeof $n.MailboxPerspective !== "undefined"
		? $n.MailboxPerspective
		: undefined;
export const Matcher =
	typeof $n.Matcher !== "undefined" ? $n.Matcher : undefined;
export const Message =
	typeof $n.Message !== "undefined" ? $n.Message : undefined;
export const MessageBodyProcessor =
	typeof $n.MessageBodyProcessor !== "undefined"
		? $n.MessageBodyProcessor
		: undefined;
export const MessageStore =
	typeof $n.MessageStore !== "undefined" ? $n.MessageStore : undefined;
export const MessageViewExtension =
	typeof $n.MessageViewExtension !== "undefined"
		? $n.MessageViewExtension
		: undefined;
export const Model = typeof $n.Model !== "undefined" ? $n.Model : undefined;
export const ModelSearchIndexer =
	typeof $n.ModelSearchIndexer !== "undefined"
		? $n.ModelSearchIndexer
		: undefined;
export const MutableQuerySubscription =
	typeof $n.MutableQuerySubscription !== "undefined"
		? $n.MutableQuerySubscription
		: undefined;
export const N1CloudAPI =
	typeof $n.N1CloudAPI !== "undefined" ? $n.N1CloudAPI : undefined;
export const NativeNotifications =
	typeof $n.NativeNotifications !== "undefined"
		? $n.NativeNotifications
		: undefined;
export const NylasAPI =
	typeof $n.NylasAPI !== "undefined" ? $n.NylasAPI : undefined;
export const NylasAPIHelpers =
	typeof $n.NylasAPIHelpers !== "undefined" ? $n.NylasAPIHelpers : undefined;
export const NylasAPIRequest =
	typeof $n.NylasAPIRequest !== "undefined" ? $n.NylasAPIRequest : undefined;
export const NylasLongConnection =
	typeof $n.NylasLongConnection !== "undefined"
		? $n.NylasLongConnection
		: undefined;
export const NylasTestUtils =
	typeof $n.NylasTestUtils !== "undefined" ? $n.NylasTestUtils : undefined;
export const ObservableListDataSource =
	typeof $n.ObservableListDataSource !== "undefined"
		? $n.ObservableListDataSource
		: undefined;
export const OnlineStatusStore =
	typeof $n.OnlineStatusStore !== "undefined"
		? $n.OnlineStatusStore
		: undefined;
export const PreferencesUIStore =
	typeof $n.PreferencesUIStore !== "undefined"
		? $n.PreferencesUIStore
		: undefined;
export const QueryResultSet =
	typeof $n.QueryResultSet !== "undefined" ? $n.QueryResultSet : undefined;
export const QuerySubscription =
	typeof $n.QuerySubscription !== "undefined"
		? $n.QuerySubscription
		: undefined;
export const QuotedHTMLTransformer =
	typeof $n.QuotedHTMLTransformer !== "undefined"
		? $n.QuotedHTMLTransformer
		: undefined;
export const React = typeof $n.React !== "undefined" ? $n.React : undefined;
export const ReactDOM =
	typeof $n.ReactDOM !== "undefined" ? $n.ReactDOM : undefined;
export const Reflux = typeof $n.Reflux !== "undefined" ? $n.Reflux : undefined;
export const RegExpUtils =
	typeof $n.RegExpUtils !== "undefined" ? $n.RegExpUtils : undefined;
export const ReprocessMailRulesTask =
	typeof $n.ReprocessMailRulesTask !== "undefined"
		? $n.ReprocessMailRulesTask
		: undefined;
export const Rx = typeof $n.Rx !== "undefined" ? $n.Rx : undefined;
export const SanitizeTransformer =
	typeof $n.SanitizeTransformer !== "undefined"
		? $n.SanitizeTransformer
		: undefined;
export const SearchIndexScheduler =
	typeof $n.SearchIndexScheduler !== "undefined"
		? $n.SearchIndexScheduler
		: undefined;
export const SearchQueryParser =
	typeof $n.SearchQueryParser !== "undefined"
		? $n.SearchQueryParser
		: undefined;
export const SearchableComponentStore =
	typeof $n.SearchableComponentStore !== "undefined"
		? $n.SearchableComponentStore
		: undefined;
export const SendActionsStore =
	typeof $n.SendActionsStore !== "undefined" ? $n.SendActionsStore : undefined;
export const SendDraftTask =
	typeof $n.SendDraftTask !== "undefined" ? $n.SendDraftTask : undefined;
export const SignatureStore =
	typeof $n.SignatureStore !== "undefined" ? $n.SignatureStore : undefined;
export const SoundRegistry =
	typeof $n.SoundRegistry !== "undefined" ? $n.SoundRegistry : undefined;
export const Spellchecker =
	typeof $n.Spellchecker !== "undefined" ? $n.Spellchecker : undefined;
export const SyncbackCategoryTask =
	typeof $n.SyncbackCategoryTask !== "undefined"
		? $n.SyncbackCategoryTask
		: undefined;
export const SyncbackEventTask =
	typeof $n.SyncbackEventTask !== "undefined"
		? $n.SyncbackEventTask
		: undefined;
export const SyncbackMetadataTask =
	typeof $n.SyncbackMetadataTask !== "undefined"
		? $n.SyncbackMetadataTask
		: undefined;
export const SystemStartService =
	typeof $n.SystemStartService !== "undefined"
		? $n.SystemStartService
		: undefined;
export const Task = typeof $n.Task !== "undefined" ? $n.Task : undefined;
export const TaskFactory =
	typeof $n.TaskFactory !== "undefined" ? $n.TaskFactory : undefined;
export const TaskQueue =
	typeof $n.TaskQueue !== "undefined" ? $n.TaskQueue : undefined;
export const TaskQueueStatusStore =
	typeof $n.TaskQueueStatusStore !== "undefined"
		? $n.TaskQueueStatusStore
		: undefined;
export const Thread = typeof $n.Thread !== "undefined" ? $n.Thread : undefined;
export const UndoRedoStore =
	typeof $n.UndoRedoStore !== "undefined" ? $n.UndoRedoStore : undefined;
export const Utils = typeof $n.Utils !== "undefined" ? $n.Utils : undefined;
export const VirtualDOMUtils =
	typeof $n.VirtualDOMUtils !== "undefined" ? $n.VirtualDOMUtils : undefined;
export const WorkspaceStore =
	typeof $n.WorkspaceStore !== "undefined" ? $n.WorkspaceStore : undefined;
