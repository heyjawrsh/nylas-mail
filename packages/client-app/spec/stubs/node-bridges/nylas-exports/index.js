// Node-resolution bridge for the app-internal "nylas-exports" module.
// Named exports are LAZY PROXIES: the bridge getters (which load real
// modules through intentional model<->store cycles) fire on first
// property/call access — post-cycle — instead of at bridge load.
// The literal `module.exports.X =` form is what cjs-module-lexer
// detects so named ESM imports link successfully.
// In the ELECTRON RENDERER (smoke runs), resolve to the bundle's already-
// loaded $n anchor instead of natively requiring the ESM source (which the
// renderer's CJS compiler rejects).
let bridge;
if (typeof process !== "undefined" && process.type === "renderer") {
	bridge = globalThis.$n || {};
} else {
	bridge = require("/Users/jawrsh/Work/Repositories/nylas_mail/packages/client-app/src/global/nylas-exports.js");
}
module.exports = bridge;

const lazyProxy = () =>
	new Proxy(function () {}, {
		get(_t, prop, receiver) {
			const real = Reflect.get(bridge, prop, receiver);
			if (real === undefined || real === null) return real;
			const v = real[prop];
			return typeof v === "function" ? v.bind(real) : v;
		},
		apply(_t, _thisArg, args) {
			return bridge(...args);
		},
	});

module.exports.APIError = lazyProxy();
module.exports.APMWrapper = lazyProxy();
module.exports.Account = lazyProxy();
module.exports.AccountStore = lazyProxy();
module.exports.Actions = lazyProxy();
module.exports.Attributes = lazyProxy();
module.exports.BadgeStore = lazyProxy();
module.exports.BaseDraftTask = lazyProxy();
module.exports.Calendar = lazyProxy();
module.exports.CalendarDataSource = lazyProxy();
module.exports.Category = lazyProxy();
module.exports.CategoryStore = lazyProxy();
module.exports.ComponentRegistry = lazyProxy();
module.exports.ComposerExtension = lazyProxy();
module.exports.Contact = lazyProxy();
module.exports.ContactStore = lazyProxy();
module.exports.ContenteditableExtension = lazyProxy();
module.exports.CustomContenteditableComponents = lazyProxy();
module.exports.DOMUtils = lazyProxy();
module.exports.DatabaseObjectRegistry = lazyProxy();
module.exports.DatabaseStore = lazyProxy();
module.exports.DateUtils = lazyProxy();
module.exports.DefaultClientHelper = lazyProxy();
module.exports.DestroyModelTask = lazyProxy();
module.exports.DraftHelpers = lazyProxy();
module.exports.DraftStore = lazyProxy();
module.exports.EditorAPI = lazyProxy();
module.exports.Event = lazyProxy();
module.exports.ExtensionRegistry = lazyProxy();
module.exports.FeatureUsageStore = lazyProxy();
module.exports.FileDownloadStore = lazyProxy();
module.exports.FocusedContactsStore = lazyProxy();
module.exports.FocusedContentStore = lazyProxy();
module.exports.FocusedPerspectiveStore = lazyProxy();
module.exports.FolderSyncProgressStore = lazyProxy();
module.exports.IdentityStore = lazyProxy();
module.exports.InflatesDraftClientId = lazyProxy();
module.exports.InlineStyleTransformer = lazyProxy();
module.exports.KeyManager = lazyProxy();
module.exports.MailRulesStore = lazyProxy();
module.exports.MailRulesTemplates = lazyProxy();
module.exports.MailboxPerspective = lazyProxy();
module.exports.Matcher = lazyProxy();
module.exports.Message = lazyProxy();
module.exports.MessageBodyProcessor = lazyProxy();
module.exports.MessageStore = lazyProxy();
module.exports.MessageViewExtension = lazyProxy();
module.exports.Model = lazyProxy();
module.exports.ModelSearchIndexer = lazyProxy();
module.exports.MutableQuerySubscription = lazyProxy();
module.exports.N1CloudAPI = lazyProxy();
module.exports.NativeNotifications = lazyProxy();
module.exports.NylasAPI = lazyProxy();
module.exports.NylasAPIHelpers = lazyProxy();
module.exports.NylasAPIRequest = lazyProxy();
module.exports.NylasLongConnection = lazyProxy();
module.exports.NylasTestUtils = lazyProxy();
module.exports.ObservableListDataSource = lazyProxy();
module.exports.OnlineStatusStore = lazyProxy();
module.exports.PreferencesUIStore = lazyProxy();
module.exports.QueryResultSet = lazyProxy();
module.exports.QuerySubscription = lazyProxy();
module.exports.QuotedHTMLTransformer = lazyProxy();
module.exports.React = lazyProxy();
module.exports.ReactDOM = lazyProxy();
module.exports.Reflux = lazyProxy();
module.exports.RegExpUtils = lazyProxy();
module.exports.ReprocessMailRulesTask = lazyProxy();
module.exports.Rx = lazyProxy();
module.exports.SanitizeTransformer = lazyProxy();
module.exports.SearchIndexScheduler = lazyProxy();
module.exports.SearchQueryParser = lazyProxy();
module.exports.SearchableComponentStore = lazyProxy();
module.exports.SendActionsStore = lazyProxy();
module.exports.SendDraftTask = lazyProxy();
module.exports.SignatureStore = lazyProxy();
module.exports.SoundRegistry = lazyProxy();
module.exports.Spellchecker = lazyProxy();
module.exports.SyncbackCategoryTask = lazyProxy();
module.exports.SyncbackEventTask = lazyProxy();
module.exports.SyncbackMetadataTask = lazyProxy();
module.exports.SystemStartService = lazyProxy();
module.exports.Task = lazyProxy();
module.exports.TaskFactory = lazyProxy();
module.exports.TaskQueue = lazyProxy();
module.exports.TaskQueueStatusStore = lazyProxy();
module.exports.TaskRegistry = lazyProxy();
module.exports.Thread = lazyProxy();
module.exports.UndoRedoStore = lazyProxy();
module.exports.Utils = lazyProxy();
module.exports.VirtualDOMUtils = lazyProxy();
module.exports.WorkspaceStore = lazyProxy();
