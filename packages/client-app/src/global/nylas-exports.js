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
globalThis.$nylasRequireSrc = (srcRel) => requireFromSrc(`../${srcRel}`);
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

const lazyLoad = (prop, pathOrThunk) => {
	// A thunk with a literal require(...) lets esbuild inline the module
	// into the renderer bundle; a string path falls back to runtime
	// resolution (dev/electron contexts).
	lazyLoadWithGetter(
		prop,
		typeof pathOrThunk === "function"
			? () => resolveExport(pathOrThunk())
			: () => resolveExport(requireFromSrc(`../${pathOrThunk}`)),
	);
};

const lazyLoadAndRegisterStore = (klassName, pathOrThunk) => {
	lazyLoad(
		klassName,
		typeof pathOrThunk === "function"
			? pathOrThunk
			: `flux/stores/${pathOrThunk}`,
	);
	StoreRegistry.register(klassName, () => $n[klassName]);
};

const lazyLoadAndRegisterModel = (klassName, pathOrThunk) => {
	lazyLoad(
		klassName,
		typeof pathOrThunk === "function"
			? pathOrThunk
			: `flux/models/${pathOrThunk}`,
	);
	DatabaseObjectRegistry.register(klassName, () => $n[klassName]);
};

const lazyLoadAndRegisterTask = (klassName, pathOrThunk) => {
	lazyLoad(
		klassName,
		typeof pathOrThunk === "function"
			? pathOrThunk
			: `flux/tasks/${pathOrThunk}`,
	);
	TaskRegistry.register(klassName, () => $n[klassName]);
};

const lazyLoadDeprecated = (prop, pathOrThunk, { instead } = {}) => {
	const { deprecate } = requireFromSrc("../deprecate-utils.js");
	Object.defineProperty($n, prop, {
		get: deprecate(prop, instead, $n, () => {
			return resolveExport(
				typeof pathOrThunk === "function"
					? pathOrThunk()
					: requireFromSrc(`../${pathOrThunk}`),
			);
		}),
		enumerable: true,
	});
};

// Actions
lazyLoad(`Actions`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../flux/actions.js").default || require("../flux/actions.js")
		: requireFromSrc("../flux/actions.js").default ||
			requireFromSrc("../flux/actions.js"),
);

// API Endpoints
lazyLoad(`NylasAPI`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../flux/nylas-api.js").default || require("../flux/nylas-api.js")
		: requireFromSrc("../flux/nylas-api.js").default ||
			requireFromSrc("../flux/nylas-api.js"),
);
lazyLoad(`N1CloudAPI`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../n1-cloud-api.js").default || require("../n1-cloud-api.js")
		: requireFromSrc("../n1-cloud-api.js").default ||
			requireFromSrc("../n1-cloud-api.js"),
);
lazyLoad(`NylasAPIHelpers`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../flux/nylas-api-helpers.js").default ||
			require("../flux/nylas-api-helpers.js")
		: requireFromSrc("../flux/nylas-api-helpers.js").default ||
			requireFromSrc("../flux/nylas-api-helpers.js"),
);
lazyLoad(`NylasAPIRequest`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../flux/nylas-api-request.js").default ||
			require("../flux/nylas-api-request.js")
		: requireFromSrc("../flux/nylas-api-request.js").default ||
			requireFromSrc("../flux/nylas-api-request.js"),
);
lazyLoad(`NylasLongConnection`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../flux/nylas-long-connection.js").default ||
			require("../flux/nylas-long-connection.js")
		: requireFromSrc("../flux/nylas-long-connection.js").default ||
			requireFromSrc("../flux/nylas-long-connection.js"),
);

lazyLoad(
	`PackageManager`,
	() =>
		requireFromSrc("../package-manager.js").default ||
		requireFromSrc("../package-manager.js"),
);
// The Database
lazyLoad(`Matcher`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../flux/attributes/matcher.js").default ||
			require("../flux/attributes/matcher.js")
		: requireFromSrc("../flux/attributes/matcher.js").default ||
			requireFromSrc("../flux/attributes/matcher.js"),
);
lazyLoad(`DatabaseStore`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../flux/stores/database-store.js").default ||
			require("../flux/stores/database-store.js")
		: requireFromSrc("../flux/stores/database-store.js").default ||
			requireFromSrc("../flux/stores/database-store.js"),
);
lazyLoad(`QueryResultSet`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../flux/models/query-result-set.js").default ||
			require("../flux/models/query-result-set.js")
		: requireFromSrc("../flux/models/query-result-set.js").default ||
			requireFromSrc("../flux/models/query-result-set.js"),
);
lazyLoad(`QuerySubscription`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../flux/models/query-subscription.js").default ||
			require("../flux/models/query-subscription.js")
		: requireFromSrc("../flux/models/query-subscription.js").default ||
			requireFromSrc("../flux/models/query-subscription.js"),
);
lazyLoad(
	`CalendarDataSource`,
	"components/nylas-calendar/calendar-data-source",
);
lazyLoad(`DatabaseWriter`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../flux/stores/database-writer.js").default ||
			require("../flux/stores/database-writer.js")
		: requireFromSrc("../flux/stores/database-writer.js").default ||
			requireFromSrc("../flux/stores/database-writer.js"),
);
lazyLoad(`MutableQueryResultSet`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../flux/models/mutable-query-result-set.js").default ||
			require("../flux/models/mutable-query-result-set.js")
		: requireFromSrc("../flux/models/mutable-query-result-set.js").default ||
			requireFromSrc("../flux/models/mutable-query-result-set.js"),
);
lazyLoad(`QuerySubscriptionPool`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../flux/models/query-subscription-pool.js").default ||
			require("../flux/models/query-subscription-pool.js")
		: requireFromSrc("../flux/models/query-subscription-pool.js").default ||
			requireFromSrc("../flux/models/query-subscription-pool.js"),
);
lazyLoad(`ObservableListDataSource`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../flux/stores/observable-list-data-source.js").default ||
			require("../flux/stores/observable-list-data-source.js")
		: requireFromSrc("../flux/stores/observable-list-data-source.js").default ||
			requireFromSrc("../flux/stores/observable-list-data-source.js"),
);
lazyLoad(`MutableQuerySubscription`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../flux/models/mutable-query-subscription.js").default ||
			require("../flux/models/mutable-query-subscription.js")
		: requireFromSrc("../flux/models/mutable-query-subscription.js").default ||
			requireFromSrc("../flux/models/mutable-query-subscription.js"),
);

// Database Objects
$n.DatabaseObjectRegistry = DatabaseObjectRegistry;
lazyLoad(`Model`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../flux/models/model.js").default ||
			require("../flux/models/model.js")
		: requireFromSrc("../flux/models/model.js").default ||
			requireFromSrc("../flux/models/model.js"),
);
lazyLoad(`Attributes`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../flux/attributes.js").default ||
			require("../flux/attributes.js")
		: requireFromSrc("../flux/attributes.js").default ||
			requireFromSrc("../flux/attributes.js"),
);
lazyLoadAndRegisterModel(`File`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../flux/models/file.js").default ||
			require("../flux/models/file.js")
		: requireFromSrc("../flux/models/file.js").default ||
			requireFromSrc("../flux/models/file.js"),
);
lazyLoadAndRegisterModel(`Event`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../flux/models/event.js").default ||
			require("../flux/models/event.js")
		: requireFromSrc("../flux/models/event.js").default ||
			requireFromSrc("../flux/models/event.js"),
);
lazyLoadAndRegisterModel(`Label`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../flux/models/label.js").default ||
			require("../flux/models/label.js")
		: requireFromSrc("../flux/models/label.js").default ||
			requireFromSrc("../flux/models/label.js"),
);
lazyLoadAndRegisterModel(`Folder`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../flux/models/folder.js").default ||
			require("../flux/models/folder.js")
		: requireFromSrc("../flux/models/folder.js").default ||
			requireFromSrc("../flux/models/folder.js"),
);
lazyLoadAndRegisterModel(`Thread`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../flux/models/thread.js").default ||
			require("../flux/models/thread.js")
		: requireFromSrc("../flux/models/thread.js").default ||
			requireFromSrc("../flux/models/thread.js"),
);
lazyLoadAndRegisterModel(`Account`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../flux/models/account.js").default ||
			require("../flux/models/account.js")
		: requireFromSrc("../flux/models/account.js").default ||
			requireFromSrc("../flux/models/account.js"),
);
lazyLoadAndRegisterModel(`Message`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../flux/models/message.js").default ||
			require("../flux/models/message.js")
		: requireFromSrc("../flux/models/message.js").default ||
			requireFromSrc("../flux/models/message.js"),
);
lazyLoadAndRegisterModel(`Contact`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../flux/models/contact.js").default ||
			require("../flux/models/contact.js")
		: requireFromSrc("../flux/models/contact.js").default ||
			requireFromSrc("../flux/models/contact.js"),
);
lazyLoadAndRegisterModel(`Category`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../flux/models/category.js").default ||
			require("../flux/models/category.js")
		: requireFromSrc("../flux/models/category.js").default ||
			requireFromSrc("../flux/models/category.js"),
);
lazyLoadAndRegisterModel(`Calendar`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../flux/models/calendar.js").default ||
			require("../flux/models/calendar.js")
		: requireFromSrc("../flux/models/calendar.js").default ||
			requireFromSrc("../flux/models/calendar.js"),
);
lazyLoadAndRegisterModel(`JSONBlob`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../flux/models/json-blob.js").default ||
			require("../flux/models/json-blob.js")
		: requireFromSrc("../flux/models/json-blob.js").default ||
			requireFromSrc("../flux/models/json-blob.js"),
);
lazyLoadAndRegisterModel(
	`ProviderSyncbackRequest`,
	"provider-syncback-request",
);

// Search Query Interfaces
lazyLoad(`SearchQueryAST`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../services/search/search-query-ast.js").default ||
			require("../services/search/search-query-ast.js")
		: requireFromSrc("../services/search/search-query-ast.js").default ||
			requireFromSrc("../services/search/search-query-ast.js"),
);
lazyLoad(`SearchQueryParser`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../services/search/search-query-parser.js").default ||
			require("../services/search/search-query-parser.js")
		: requireFromSrc("../services/search/search-query-parser.js").default ||
			requireFromSrc("../services/search/search-query-parser.js"),
);
lazyLoad(`IMAPSearchQueryBackend`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../services/search/search-query-backend-imap.js").default ||
			require("../services/search/search-query-backend-imap.js")
		: requireFromSrc("../services/search/search-query-backend-imap.js")
				.default ||
			requireFromSrc("../services/search/search-query-backend-imap.js"),
);

// Tasks
$n.TaskRegistry = TaskRegistry;
lazyLoad(`Task`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../flux/tasks/task.js").default ||
			require("../flux/tasks/task.js")
		: requireFromSrc("../flux/tasks/task.js").default ||
			requireFromSrc("../flux/tasks/task.js"),
);
lazyLoad(`TaskFactory`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../flux/tasks/task-factory.js").default ||
			require("../flux/tasks/task-factory.js")
		: requireFromSrc("../flux/tasks/task-factory.js").default ||
			requireFromSrc("../flux/tasks/task-factory.js"),
);
lazyLoadAndRegisterTask(`EventRSVPTask`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../flux/tasks/event-rsvp-task.js").default ||
			require("../flux/tasks/event-rsvp-task.js")
		: requireFromSrc("../flux/tasks/event-rsvp-task.js").default ||
			requireFromSrc("../flux/tasks/event-rsvp-task.js"),
);
lazyLoadAndRegisterTask(`BaseDraftTask`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../flux/tasks/base-draft-task.js").default ||
			require("../flux/tasks/base-draft-task.js")
		: requireFromSrc("../flux/tasks/base-draft-task.js").default ||
			requireFromSrc("../flux/tasks/base-draft-task.js"),
);
lazyLoadAndRegisterTask(`SendDraftTask`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../flux/tasks/send-draft-task.js").default ||
			require("../flux/tasks/send-draft-task.js")
		: requireFromSrc("../flux/tasks/send-draft-task.js").default ||
			requireFromSrc("../flux/tasks/send-draft-task.js"),
);
lazyLoadAndRegisterTask(`ChangeMailTask`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../flux/tasks/change-mail-task.js").default ||
			require("../flux/tasks/change-mail-task.js")
		: requireFromSrc("../flux/tasks/change-mail-task.js").default ||
			requireFromSrc("../flux/tasks/change-mail-task.js"),
);
lazyLoadAndRegisterTask(`DestroyDraftTask`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../flux/tasks/destroy-draft-task.js").default ||
			require("../flux/tasks/destroy-draft-task.js")
		: requireFromSrc("../flux/tasks/destroy-draft-task.js").default ||
			requireFromSrc("../flux/tasks/destroy-draft-task.js"),
);
lazyLoadAndRegisterTask(`ChangeLabelsTask`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../flux/tasks/change-labels-task.js").default ||
			require("../flux/tasks/change-labels-task.js")
		: requireFromSrc("../flux/tasks/change-labels-task.js").default ||
			requireFromSrc("../flux/tasks/change-labels-task.js"),
);
lazyLoadAndRegisterTask(`ChangeFolderTask`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../flux/tasks/change-folder-task.js").default ||
			require("../flux/tasks/change-folder-task.js")
		: requireFromSrc("../flux/tasks/change-folder-task.js").default ||
			requireFromSrc("../flux/tasks/change-folder-task.js"),
);
lazyLoadAndRegisterTask(`ChangeUnreadTask`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../flux/tasks/change-unread-task.js").default ||
			require("../flux/tasks/change-unread-task.js")
		: requireFromSrc("../flux/tasks/change-unread-task.js").default ||
			requireFromSrc("../flux/tasks/change-unread-task.js"),
);
lazyLoadAndRegisterTask(`DestroyModelTask`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../flux/tasks/destroy-model-task.js").default ||
			require("../flux/tasks/destroy-model-task.js")
		: requireFromSrc("../flux/tasks/destroy-model-task.js").default ||
			requireFromSrc("../flux/tasks/destroy-model-task.js"),
);
lazyLoadAndRegisterTask(`ChangeStarredTask`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../flux/tasks/change-starred-task.js").default ||
			require("../flux/tasks/change-starred-task.js")
		: requireFromSrc("../flux/tasks/change-starred-task.js").default ||
			requireFromSrc("../flux/tasks/change-starred-task.js"),
);
lazyLoadAndRegisterTask(`SyncbackModelTask`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../flux/tasks/syncback-model-task.js").default ||
			require("../flux/tasks/syncback-model-task.js")
		: requireFromSrc("../flux/tasks/syncback-model-task.js").default ||
			requireFromSrc("../flux/tasks/syncback-model-task.js"),
);
lazyLoadAndRegisterTask(`SyncbackEventTask`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../flux/tasks/syncback-event-task.js").default ||
			require("../flux/tasks/syncback-event-task.js")
		: requireFromSrc("../flux/tasks/syncback-event-task.js").default ||
			requireFromSrc("../flux/tasks/syncback-event-task.js"),
);
lazyLoadAndRegisterTask(`DestroyCategoryTask`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../flux/tasks/destroy-category-task.js").default ||
			require("../flux/tasks/destroy-category-task.js")
		: requireFromSrc("../flux/tasks/destroy-category-task.js").default ||
			requireFromSrc("../flux/tasks/destroy-category-task.js"),
);
lazyLoadAndRegisterTask(`SyncbackCategoryTask`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../flux/tasks/syncback-category-task.js").default ||
			require("../flux/tasks/syncback-category-task.js")
		: requireFromSrc("../flux/tasks/syncback-category-task.js").default ||
			requireFromSrc("../flux/tasks/syncback-category-task.js"),
);
lazyLoadAndRegisterTask(`SyncbackMetadataTask`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../flux/tasks/syncback-metadata-task.js").default ||
			require("../flux/tasks/syncback-metadata-task.js")
		: requireFromSrc("../flux/tasks/syncback-metadata-task.js").default ||
			requireFromSrc("../flux/tasks/syncback-metadata-task.js"),
);
lazyLoadAndRegisterTask(`PerformSendActionTask`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../flux/tasks/perform-send-action-task.js").default ||
			require("../flux/tasks/perform-send-action-task.js")
		: requireFromSrc("../flux/tasks/perform-send-action-task.js").default ||
			requireFromSrc("../flux/tasks/perform-send-action-task.js"),
);
lazyLoadAndRegisterTask(`ReprocessMailRulesTask`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../flux/tasks/reprocess-mail-rules-task.js").default ||
			require("../flux/tasks/reprocess-mail-rules-task.js")
		: requireFromSrc("../flux/tasks/reprocess-mail-rules-task.js").default ||
			requireFromSrc("../flux/tasks/reprocess-mail-rules-task.js"),
);
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
lazyLoadAndRegisterStore(`TaskQueue`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../flux/stores/task-queue.js").default ||
			require("../flux/stores/task-queue.js")
		: requireFromSrc("../flux/stores/task-queue.js").default ||
			requireFromSrc("../flux/stores/task-queue.js"),
);
lazyLoadAndRegisterStore(`BadgeStore`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../flux/stores/badge-store.js").default ||
			require("../flux/stores/badge-store.js")
		: requireFromSrc("../flux/stores/badge-store.js").default ||
			requireFromSrc("../flux/stores/badge-store.js"),
);
lazyLoadAndRegisterStore(`DraftStore`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../flux/stores/draft-store.js").default ||
			require("../flux/stores/draft-store.js")
		: requireFromSrc("../flux/stores/draft-store.js").default ||
			requireFromSrc("../flux/stores/draft-store.js"),
);
lazyLoadAndRegisterStore(`ModalStore`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../flux/stores/modal-store.jsx").default ||
			require("../flux/stores/modal-store.jsx")
		: requireFromSrc("../flux/stores/modal-store.jsx").default ||
			requireFromSrc("../flux/stores/modal-store.jsx"),
);
lazyLoadAndRegisterStore(`OutboxStore`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../flux/stores/outbox-store.js").default ||
			require("../flux/stores/outbox-store.js")
		: requireFromSrc("../flux/stores/outbox-store.js").default ||
			requireFromSrc("../flux/stores/outbox-store.js"),
);
lazyLoadAndRegisterStore(`PopoverStore`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../flux/stores/popover-store.jsx").default ||
			require("../flux/stores/popover-store.jsx")
		: requireFromSrc("../flux/stores/popover-store.jsx").default ||
			requireFromSrc("../flux/stores/popover-store.jsx"),
);
lazyLoadAndRegisterStore(`AccountStore`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../flux/stores/account-store.js").default ||
			require("../flux/stores/account-store.js")
		: requireFromSrc("../flux/stores/account-store.js").default ||
			requireFromSrc("../flux/stores/account-store.js"),
);
lazyLoadAndRegisterStore(`SignatureStore`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../flux/stores/signature-store.js").default ||
			require("../flux/stores/signature-store.js")
		: requireFromSrc("../flux/stores/signature-store.js").default ||
			requireFromSrc("../flux/stores/signature-store.js"),
);
lazyLoadAndRegisterStore(`MessageStore`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../flux/stores/message-store.js").default ||
			require("../flux/stores/message-store.js")
		: requireFromSrc("../flux/stores/message-store.js").default ||
			requireFromSrc("../flux/stores/message-store.js"),
);
lazyLoadAndRegisterStore(`ContactStore`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../flux/stores/contact-store.js").default ||
			require("../flux/stores/contact-store.js")
		: requireFromSrc("../flux/stores/contact-store.js").default ||
			requireFromSrc("../flux/stores/contact-store.js"),
);
lazyLoadAndRegisterStore(`IdentityStore`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../flux/stores/identity-store.js").default ||
			require("../flux/stores/identity-store.js")
		: requireFromSrc("../flux/stores/identity-store.js").default ||
			requireFromSrc("../flux/stores/identity-store.js"),
);
lazyLoadAndRegisterStore(`MetadataStore`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../flux/stores/metadata-store.js").default ||
			require("../flux/stores/metadata-store.js")
		: requireFromSrc("../flux/stores/metadata-store.js").default ||
			requireFromSrc("../flux/stores/metadata-store.js"),
);
lazyLoadAndRegisterStore(`CategoryStore`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../flux/stores/category-store.js").default ||
			require("../flux/stores/category-store.js")
		: requireFromSrc("../flux/stores/category-store.js").default ||
			requireFromSrc("../flux/stores/category-store.js"),
);
lazyLoadAndRegisterStore(`UndoRedoStore`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../flux/stores/undo-redo-store.js").default ||
			require("../flux/stores/undo-redo-store.js")
		: requireFromSrc("../flux/stores/undo-redo-store.js").default ||
			requireFromSrc("../flux/stores/undo-redo-store.js"),
);
lazyLoadAndRegisterStore(`WorkspaceStore`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../flux/stores/workspace-store.js").default ||
			require("../flux/stores/workspace-store.js")
		: requireFromSrc("../flux/stores/workspace-store.js").default ||
			requireFromSrc("../flux/stores/workspace-store.js"),
);
lazyLoadAndRegisterStore(`MailRulesStore`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../flux/stores/mail-rules-store.js").default ||
			require("../flux/stores/mail-rules-store.js")
		: requireFromSrc("../flux/stores/mail-rules-store.js").default ||
			requireFromSrc("../flux/stores/mail-rules-store.js"),
);
lazyLoadAndRegisterStore(`FileUploadStore`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../flux/stores/file-upload-store.js").default ||
			require("../flux/stores/file-upload-store.js")
		: requireFromSrc("../flux/stores/file-upload-store.js").default ||
			requireFromSrc("../flux/stores/file-upload-store.js"),
);
lazyLoadAndRegisterStore(`SendActionsStore`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../flux/stores/send-actions-store.js").default ||
			require("../flux/stores/send-actions-store.js")
		: requireFromSrc("../flux/stores/send-actions-store.js").default ||
			requireFromSrc("../flux/stores/send-actions-store.js"),
);
lazyLoadAndRegisterStore(`FeatureUsageStore`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../flux/stores/feature-usage-store.jsx").default ||
			require("../flux/stores/feature-usage-store.jsx")
		: requireFromSrc("../flux/stores/feature-usage-store.jsx").default ||
			requireFromSrc("../flux/stores/feature-usage-store.jsx"),
);
lazyLoadAndRegisterStore(`ThreadCountsStore`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../flux/stores/thread-counts-store.js").default ||
			require("../flux/stores/thread-counts-store.js")
		: requireFromSrc("../flux/stores/thread-counts-store.js").default ||
			requireFromSrc("../flux/stores/thread-counts-store.js"),
);
lazyLoadAndRegisterStore(`FileDownloadStore`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../flux/stores/file-download-store.js").default ||
			require("../flux/stores/file-download-store.js")
		: requireFromSrc("../flux/stores/file-download-store.js").default ||
			requireFromSrc("../flux/stores/file-download-store.js"),
);
lazyLoadAndRegisterStore(`OnlineStatusStore`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../flux/stores/online-status-store.js").default ||
			require("../flux/stores/online-status-store.js")
		: requireFromSrc("../flux/stores/online-status-store.js").default ||
			requireFromSrc("../flux/stores/online-status-store.js"),
);
lazyLoadAndRegisterStore(`PreferencesUIStore`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../flux/stores/preferences-ui-store.js").default ||
			require("../flux/stores/preferences-ui-store.js")
		: requireFromSrc("../flux/stores/preferences-ui-store.js").default ||
			requireFromSrc("../flux/stores/preferences-ui-store.js"),
);
lazyLoadAndRegisterStore(`FocusedContentStore`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../flux/stores/focused-content-store.js").default ||
			require("../flux/stores/focused-content-store.js")
		: requireFromSrc("../flux/stores/focused-content-store.js").default ||
			requireFromSrc("../flux/stores/focused-content-store.js"),
);
lazyLoadAndRegisterStore(`MessageBodyProcessor`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../flux/stores/message-body-processor.js").default ||
			require("../flux/stores/message-body-processor.js")
		: requireFromSrc("../flux/stores/message-body-processor.js").default ||
			requireFromSrc("../flux/stores/message-body-processor.js"),
);
lazyLoadAndRegisterStore(`FocusedContactsStore`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../flux/stores/focused-contacts-store.js").default ||
			require("../flux/stores/focused-contacts-store.js")
		: requireFromSrc("../flux/stores/focused-contacts-store.js").default ||
			requireFromSrc("../flux/stores/focused-contacts-store.js"),
);
lazyLoadAndRegisterStore(`DeltaConnectionStore`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../flux/stores/delta-connection-store.js").default ||
			require("../flux/stores/delta-connection-store.js")
		: requireFromSrc("../flux/stores/delta-connection-store.js").default ||
			requireFromSrc("../flux/stores/delta-connection-store.js"),
);
lazyLoadAndRegisterStore(`TaskQueueStatusStore`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../flux/stores/task-queue-status-store.js").default ||
			require("../flux/stores/task-queue-status-store.js")
		: requireFromSrc("../flux/stores/task-queue-status-store.js").default ||
			requireFromSrc("../flux/stores/task-queue-status-store.js"),
);
lazyLoadAndRegisterStore(
	`FolderSyncProgressStore`,
	"folder-sync-progress-store",
);
lazyLoadAndRegisterStore(`ThreadListActionsStore`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../flux/stores/thread-list-actions-store.js").default ||
			require("../flux/stores/thread-list-actions-store.js")
		: requireFromSrc("../flux/stores/thread-list-actions-store.js").default ||
			requireFromSrc("../flux/stores/thread-list-actions-store.js"),
);
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
lazyLoad(`InflatesDraftClientId`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../decorators/inflates-draft-client-id.jsx").default ||
			require("../decorators/inflates-draft-client-id.jsx")
		: requireFromSrc("../decorators/inflates-draft-client-id.jsx").default ||
			requireFromSrc("../decorators/inflates-draft-client-id.jsx"),
);

// Extensions
lazyLoad(`ExtensionRegistry`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../registries/extension-registry.js").default ||
			require("../registries/extension-registry.js")
		: requireFromSrc("../registries/extension-registry.js").default ||
			requireFromSrc("../registries/extension-registry.js"),
);
lazyLoad(`ComposerExtension`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../extensions/composer-extension.js").default ||
			require("../extensions/composer-extension.js")
		: requireFromSrc("../extensions/composer-extension.js").default ||
			requireFromSrc("../extensions/composer-extension.js"),
);
lazyLoad(`MessageViewExtension`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../extensions/message-view-extension.js").default ||
			require("../extensions/message-view-extension.js")
		: requireFromSrc("../extensions/message-view-extension.js").default ||
			requireFromSrc("../extensions/message-view-extension.js"),
);
lazyLoad(`ContenteditableExtension`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../extensions/contenteditable-extension.js").default ||
			require("../extensions/contenteditable-extension.js")
		: requireFromSrc("../extensions/contenteditable-extension.js").default ||
			requireFromSrc("../extensions/contenteditable-extension.js"),
);

// 3rd party libraries
lazyLoadWithGetter(`Rx`, () => nodeRequire("rxjs"));
lazyLoadWithGetter(`React`, () => nodeRequire("react"));
lazyLoadWithGetter(`Reflux`, () => nodeRequire("reflux"));
lazyLoadWithGetter(`ReactDOM`, () => nodeRequire("react-dom"));
lazyLoadWithGetter(`ReactTestUtils`, () => nodeRequire("react-dom/test-utils"));

// React Components
lazyLoad(`ComponentRegistry`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../registries/component-registry.js").default ||
			require("../registries/component-registry.js")
		: requireFromSrc("../registries/component-registry.js").default ||
			requireFromSrc("../registries/component-registry.js"),
);
lazyLoad(`PriorityUICoordinator`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../priority-ui-coordinator.js").default ||
			require("../priority-ui-coordinator.js")
		: requireFromSrc("../priority-ui-coordinator.js").default ||
			requireFromSrc("../priority-ui-coordinator.js"),
);

// Utils
lazyLoad(`Utils`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../flux/models/utils.js").default ||
			require("../flux/models/utils.js")
		: requireFromSrc("../flux/models/utils.js").default ||
			requireFromSrc("../flux/models/utils.js"),
);
lazyLoad(`DOMUtils`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../dom-utils.js").default || require("../dom-utils.js")
		: requireFromSrc("../dom-utils.js").default ||
			requireFromSrc("../dom-utils.js"),
);
lazyLoad(`DateUtils`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../date-utils.js").default || require("../date-utils.js")
		: requireFromSrc("../date-utils.js").default ||
			requireFromSrc("../date-utils.js"),
);
lazyLoad(`FsUtils`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../fs-utils.js").default || require("../fs-utils.js")
		: requireFromSrc("../fs-utils.js").default ||
			requireFromSrc("../fs-utils.js"),
);
lazyLoad(`CanvasUtils`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../canvas-utils.js").default || require("../canvas-utils.js")
		: requireFromSrc("../canvas-utils.js").default ||
			requireFromSrc("../canvas-utils.js"),
);
lazyLoad(`RegExpUtils`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../regexp-utils.js").default || require("../regexp-utils.js")
		: requireFromSrc("../regexp-utils.js").default ||
			requireFromSrc("../regexp-utils.js"),
);
lazyLoad(`MenuHelpers`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../menu-helpers.js").default || require("../menu-helpers.js")
		: requireFromSrc("../menu-helpers.js").default ||
			requireFromSrc("../menu-helpers.js"),
);
lazyLoad(`DeprecateUtils`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../deprecate-utils.js").default ||
			require("../deprecate-utils.js")
		: requireFromSrc("../deprecate-utils.js").default ||
			requireFromSrc("../deprecate-utils.js"),
);
lazyLoad(`VirtualDOMUtils`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../virtual-dom-utils.js").default ||
			require("../virtual-dom-utils.js")
		: requireFromSrc("../virtual-dom-utils.js").default ||
			requireFromSrc("../virtual-dom-utils.js"),
);
lazyLoad(`Spellchecker`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../spellchecker.js").default || require("../spellchecker.js")
		: requireFromSrc("../spellchecker.js").default ||
			requireFromSrc("../spellchecker.js"),
);
lazyLoad(`DraftHelpers`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../flux/stores/draft-helpers.js").default ||
			require("../flux/stores/draft-helpers.js")
		: requireFromSrc("../flux/stores/draft-helpers.js").default ||
			requireFromSrc("../flux/stores/draft-helpers.js"),
);
lazyLoad(`MessageUtils`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../flux/models/message-utils.js").default ||
			require("../flux/models/message-utils.js")
		: requireFromSrc("../flux/models/message-utils.js").default ||
			requireFromSrc("../flux/models/message-utils.js"),
);
lazyLoad(`EditorAPI`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../components/contenteditable/editor-api.js").default ||
			require("../components/contenteditable/editor-api.js")
		: requireFromSrc("../components/contenteditable/editor-api.js").default ||
			requireFromSrc("../components/contenteditable/editor-api.js"),
);

// Services
lazyLoad(`KeyManager`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../key-manager.js").default || require("../key-manager.js")
		: requireFromSrc("../key-manager.js").default ||
			requireFromSrc("../key-manager.js"),
);
lazyLoad(`SoundRegistry`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../registries/sound-registry.js").default ||
			require("../registries/sound-registry.js")
		: requireFromSrc("../registries/sound-registry.js").default ||
			requireFromSrc("../registries/sound-registry.js"),
);
lazyLoad(`MailRulesTemplates`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../mail-rules-templates.js").default ||
			require("../mail-rules-templates.js")
		: requireFromSrc("../mail-rules-templates.js").default ||
			requireFromSrc("../mail-rules-templates.js"),
);
lazyLoad(`MailRulesProcessor`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../mail-rules-processor.js").default ||
			require("../mail-rules-processor.js")
		: requireFromSrc("../mail-rules-processor.js").default ||
			requireFromSrc("../mail-rules-processor.js"),
);
lazyLoad(`MailboxPerspective`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../mailbox-perspective.js").default ||
			require("../mailbox-perspective.js")
		: requireFromSrc("../mailbox-perspective.js").default ||
			requireFromSrc("../mailbox-perspective.js"),
);
lazyLoad(`DeltaProcessor`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../services/delta-processor.js").default ||
			require("../services/delta-processor.js")
		: requireFromSrc("../services/delta-processor.js").default ||
			requireFromSrc("../services/delta-processor.js"),
);
lazyLoad(`NativeNotifications`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../native-notifications.js").default ||
			require("../native-notifications.js")
		: requireFromSrc("../native-notifications.js").default ||
			requireFromSrc("../native-notifications.js"),
);
lazyLoad(`ModelSearchIndexer`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../services/model-search-indexer.js").default ||
			require("../services/model-search-indexer.js")
		: requireFromSrc("../services/model-search-indexer.js").default ||
			requireFromSrc("../services/model-search-indexer.js"),
);
lazyLoad(`SearchIndexScheduler`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../services/search-index-scheduler.js").default ||
			require("../services/search-index-scheduler.js")
		: requireFromSrc("../services/search-index-scheduler.js").default ||
			requireFromSrc("../services/search-index-scheduler.js"),
);
lazyLoad(`SanitizeTransformer`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../services/sanitize-transformer.js").default ||
			require("../services/sanitize-transformer.js")
		: requireFromSrc("../services/sanitize-transformer.js").default ||
			requireFromSrc("../services/sanitize-transformer.js"),
);
lazyLoad(`QuotedHTMLTransformer`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../services/quoted-html-transformer.js").default ||
			require("../services/quoted-html-transformer.js")
		: requireFromSrc("../services/quoted-html-transformer.js").default ||
			requireFromSrc("../services/quoted-html-transformer.js"),
);
lazyLoad(`InlineStyleTransformer`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../services/inline-style-transformer.js").default ||
			require("../services/inline-style-transformer.js")
		: requireFromSrc("../services/inline-style-transformer.js").default ||
			requireFromSrc("../services/inline-style-transformer.js"),
);
lazyLoad(
	`SearchableComponentMaker`,
	"searchable-components/searchable-component-maker",
);
lazyLoad(
	`QuotedPlainTextTransformer`,
	"services/quoted-plain-text-transformer",
);
lazyLoad(`BatteryStatusManager`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../services/battery-status-manager.js").default ||
			require("../services/battery-status-manager.js")
		: requireFromSrc("../services/battery-status-manager.js").default ||
			requireFromSrc("../services/battery-status-manager.js"),
);

// Errors
lazyLoadWithGetter(`APIError`, () => nodeRequire("../flux/errors.js").APIError);

// Process Internals
lazyLoad(`DefaultClientHelper`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../default-client-helper.js").default ||
			require("../default-client-helper.js")
		: requireFromSrc("../default-client-helper.js").default ||
			requireFromSrc("../default-client-helper.js"),
);
lazyLoad(`BufferedProcess`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../buffered-process.js").default ||
			require("../buffered-process.js")
		: requireFromSrc("../buffered-process.js").default ||
			requireFromSrc("../buffered-process.js"),
);
lazyLoad(`SystemStartService`, () =>
	typeof require !== "undefined" && require.resolve
		? require("../system-start-service.js").default ||
			require("../system-start-service.js")
		: requireFromSrc("../system-start-service.js").default ||
			requireFromSrc("../system-start-service.js"),
);
lazyLoadWithGetter(`APMWrapper`, () => nodeRequire("../apm-wrapper.js"));

// Testing
lazyLoadWithGetter(`NylasTestUtils`, () =>
	nodeRequire("../../spec/nylas-test-utils.js"),
);

// Deprecated
lazyLoadDeprecated(
	`QuotedHTMLParser`,
	() =>
		typeof require !== "undefined" && require.resolve
			? require("../services/quoted-html-transformer.js").default ||
				require("../services/quoted-html-transformer.js")
			: requireFromSrc("../services/quoted-html-transformer.js").default ||
				requireFromSrc("../services/quoted-html-transformer.js"),
	{
		instead: "QuotedHTMLTransformer",
	},
);
lazyLoadDeprecated(
	`DraftStoreExtension`,
	() =>
		typeof require !== "undefined" && require.resolve
			? require("../flux/stores/draft-store-extension.js").default ||
				require("../flux/stores/draft-store-extension.js")
			: requireFromSrc("../flux/stores/draft-store-extension.js").default ||
				requireFromSrc("../flux/stores/draft-store-extension.js"),
	{
		instead: "ComposerExtension",
	},
);
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
