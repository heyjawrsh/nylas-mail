// Test-resolution shim for nyl-exports: named exports are LAZY PROXIES
// over the runtime bridge getters. Eager materialization fired the
// app's intentional model<->store cycles mid-load; proxies defer every
// read until first access (post-cycle).
// Resolve the bridge through the vite pipeline (NOT native require) so a
// single instance exists alongside vi.mock-ed spec dependencies.
import bridgeNS from "../../src/global/nylas-exports.js";

const lazy = (name) =>
	new Proxy(function lazyBridge() {}, {
		get(_t, prop) {
			const real = bridgeNS[name];
			if (real === undefined || real === null) return real;
			// NOTE: unbound — bound functions lose .prototype and break
			// `class X extends Proxy.get(...)` consumers (React.Component).
			const v = real[prop];
			return v;
		},
		apply(_t, _thisArg, args) {
			return bridgeNS[name](...args);
		},
		construct(_t, args, newTarget) {
			const Real = bridgeNS[name];
			return Reflect.construct(Real, args, newTarget);
		},
		has(_t, prop) {
			return prop in (bridgeNS[name] || {});
		},
	});

export const APIError = lazy("APIError");
export const APMWrapper = lazy("APMWrapper");
export const Account = lazy("Account");
export const AccountStore = lazy("AccountStore");
export const Actions = lazy("Actions");
export const Attributes = lazy("Attributes");
export const BadgeStore = lazy("BadgeStore");
export const BaseDraftTask = lazy("BaseDraftTask");
export const Calendar = lazy("Calendar");
export const CalendarDataSource = lazy("CalendarDataSource");
export const Category = lazy("Category");
export const CategoryStore = lazy("CategoryStore");
export const ComponentRegistry = lazy("ComponentRegistry");
export const ComposerExtension = lazy("ComposerExtension");
export const Contact = lazy("Contact");
export const ContactStore = lazy("ContactStore");
export const ContenteditableExtension = lazy("ContenteditableExtension");
export const CustomContenteditableComponents = lazy("CustomContenteditableComponents");
export const DOMUtils = lazy("DOMUtils");
export const DatabaseObjectRegistry = lazy("DatabaseObjectRegistry");
export const DatabaseStore = lazy("DatabaseStore");
export const DateUtils = lazy("DateUtils");
export const DefaultClientHelper = lazy("DefaultClientHelper");
export const DestroyModelTask = lazy("DestroyModelTask");
export const DraftHelpers = lazy("DraftHelpers");
export const DraftStore = lazy("DraftStore");
export const EditorAPI = lazy("EditorAPI");
export const Event = lazy("Event");
export const ExtensionRegistry = lazy("ExtensionRegistry");
export const FeatureUsageStore = lazy("FeatureUsageStore");
export const FileDownloadStore = lazy("FileDownloadStore");
export const FocusedContactsStore = lazy("FocusedContactsStore");
export const FocusedContentStore = lazy("FocusedContentStore");
export const FocusedPerspectiveStore = lazy("FocusedPerspectiveStore");
export const FolderSyncProgressStore = lazy("FolderSyncProgressStore");
export const IdentityStore = lazy("IdentityStore");
export const InflatesDraftClientId = lazy("InflatesDraftClientId");
export const InlineStyleTransformer = lazy("InlineStyleTransformer");
export const KeyManager = lazy("KeyManager");
export const MailRulesStore = lazy("MailRulesStore");
export const MailRulesTemplates = lazy("MailRulesTemplates");
export const MailboxPerspective = lazy("MailboxPerspective");
export const Matcher = lazy("Matcher");
export const Message = lazy("Message");
export const MessageBodyProcessor = lazy("MessageBodyProcessor");
export const MessageStore = lazy("MessageStore");
export const MessageViewExtension = lazy("MessageViewExtension");
export const Model = lazy("Model");
export const ModelSearchIndexer = lazy("ModelSearchIndexer");
export const MutableQuerySubscription = lazy("MutableQuerySubscription");
export const N1CloudAPI = lazy("N1CloudAPI");
export const NativeNotifications = lazy("NativeNotifications");
export const NylasAPI = lazy("NylasAPI");
export const NylasAPIHelpers = lazy("NylasAPIHelpers");
export const NylasAPIRequest = lazy("NylasAPIRequest");
export const NylasLongConnection = lazy("NylasLongConnection");
export const NylasTestUtils = lazy("NylasTestUtils");
export const ObservableListDataSource = lazy("ObservableListDataSource");
export const OnlineStatusStore = lazy("OnlineStatusStore");
export const PreferencesUIStore = lazy("PreferencesUIStore");
export const QueryResultSet = lazy("QueryResultSet");
export const QuerySubscription = lazy("QuerySubscription");
export const QuotedHTMLTransformer = lazy("QuotedHTMLTransformer");
export const React = lazy("React");
export const ReactDOM = lazy("ReactDOM");
export const Reflux = lazy("Reflux");
export const RegExpUtils = lazy("RegExpUtils");
export const ReprocessMailRulesTask = lazy("ReprocessMailRulesTask");
export const Rx = lazy("Rx");
export const SanitizeTransformer = lazy("SanitizeTransformer");
export const SearchIndexScheduler = lazy("SearchIndexScheduler");
export const SearchQueryParser = lazy("SearchQueryParser");
export const SearchableComponentStore = lazy("SearchableComponentStore");
export const SendActionsStore = lazy("SendActionsStore");
export const SendDraftTask = lazy("SendDraftTask");
export const SignatureStore = lazy("SignatureStore");
export const SoundRegistry = lazy("SoundRegistry");
export const Spellchecker = lazy("Spellchecker");
export const SyncbackCategoryTask = lazy("SyncbackCategoryTask");
export const SyncbackEventTask = lazy("SyncbackEventTask");
export const SyncbackMetadataTask = lazy("SyncbackMetadataTask");
export const SystemStartService = lazy("SystemStartService");
export const Task = lazy("Task");
export const TaskFactory = lazy("TaskFactory");
export const TaskQueue = lazy("TaskQueue");
export const TaskQueueStatusStore = lazy("TaskQueueStatusStore");
export const TaskRegistry = lazy("TaskRegistry");
export const Thread = lazy("Thread");
export const UndoRedoStore = lazy("UndoRedoStore");
export const Utils = lazy("Utils");
export const VirtualDOMUtils = lazy("VirtualDOMUtils");
export const WorkspaceStore = lazy("WorkspaceStore");
export default bridgeNS;
