// Test-resolution shim: materializes the lazy getter exports of the
// runtime bridge so vitest static named-import analysis sees them.
// Each read is guarded: the app module graph has intentional
// model<->store cycles that only resolve lazily; a read that lands
// mid-cycle yields undefined rather than aborting the whole suite.
import bridge from "../../src/global/nylas-exports.js";

const safe = (name) => {
	try {
		return bridge[name];
	} catch (_e) {
		return undefined;
	}
};

export const APIError = safe("APIError");
export const APMWrapper = safe("APMWrapper");
export const Account = safe("Account");
export const AccountStore = safe("AccountStore");
export const Actions = safe("Actions");
export const Attributes = safe("Attributes");
export const BadgeStore = safe("BadgeStore");
export const BaseDraftTask = safe("BaseDraftTask");
export const Calendar = safe("Calendar");
export const CalendarDataSource = safe("CalendarDataSource");
export const Category = safe("Category");
export const CategoryStore = safe("CategoryStore");
export const ComponentRegistry = safe("ComponentRegistry");
export const ComposerExtension = safe("ComposerExtension");
export const Contact = safe("Contact");
export const ContactStore = safe("ContactStore");
export const ContenteditableExtension = safe("ContenteditableExtension");
export const CustomContenteditableComponents = safe("CustomContenteditableComponents");
export const DOMUtils = safe("DOMUtils");
export const DatabaseObjectRegistry = safe("DatabaseObjectRegistry");
export const DatabaseStore = safe("DatabaseStore");
export const DateUtils = safe("DateUtils");
export const DefaultClientHelper = safe("DefaultClientHelper");
export const DestroyModelTask = safe("DestroyModelTask");
export const DraftHelpers = safe("DraftHelpers");
export const DraftStore = safe("DraftStore");
export const EditorAPI = safe("EditorAPI");
export const Event = safe("Event");
export const ExtensionRegistry = safe("ExtensionRegistry");
export const FeatureUsageStore = safe("FeatureUsageStore");
export const FileDownloadStore = safe("FileDownloadStore");
export const FocusedContactsStore = safe("FocusedContactsStore");
export const FocusedContentStore = safe("FocusedContentStore");
export const FocusedPerspectiveStore = safe("FocusedPerspectiveStore");
export const FolderSyncProgressStore = safe("FolderSyncProgressStore");
export const IdentityStore = safe("IdentityStore");
export const InflatesDraftClientId = safe("InflatesDraftClientId");
export const InlineStyleTransformer = safe("InlineStyleTransformer");
export const KeyManager = safe("KeyManager");
export const MailRulesStore = safe("MailRulesStore");
export const MailRulesTemplates = safe("MailRulesTemplates");
export const MailboxPerspective = safe("MailboxPerspective");
export const Matcher = safe("Matcher");
export const Message = safe("Message");
export const MessageBodyProcessor = safe("MessageBodyProcessor");
export const MessageStore = safe("MessageStore");
export const MessageViewExtension = safe("MessageViewExtension");
export const Model = safe("Model");
export const ModelSearchIndexer = safe("ModelSearchIndexer");
export const MutableQuerySubscription = safe("MutableQuerySubscription");
export const N1CloudAPI = safe("N1CloudAPI");
export const NativeNotifications = safe("NativeNotifications");
export const NylasAPI = safe("NylasAPI");
export const NylasAPIHelpers = safe("NylasAPIHelpers");
export const NylasAPIRequest = safe("NylasAPIRequest");
export const NylasLongConnection = safe("NylasLongConnection");
export const NylasTestUtils = safe("NylasTestUtils");
export const ObservableListDataSource = safe("ObservableListDataSource");
export const OnlineStatusStore = safe("OnlineStatusStore");
export const PreferencesUIStore = safe("PreferencesUIStore");
export const QueryResultSet = safe("QueryResultSet");
export const QuerySubscription = safe("QuerySubscription");
export const QuotedHTMLTransformer = safe("QuotedHTMLTransformer");
export const React = safe("React");
export const ReactDOM = safe("ReactDOM");
export const Reflux = safe("Reflux");
export const RegExpUtils = safe("RegExpUtils");
export const ReprocessMailRulesTask = safe("ReprocessMailRulesTask");
export const Rx = safe("Rx");
export const SanitizeTransformer = safe("SanitizeTransformer");
export const SearchIndexScheduler = safe("SearchIndexScheduler");
export const SearchQueryParser = safe("SearchQueryParser");
export const SearchableComponentStore = safe("SearchableComponentStore");
export const SendActionsStore = safe("SendActionsStore");
export const SendDraftTask = safe("SendDraftTask");
export const SignatureStore = safe("SignatureStore");
export const SoundRegistry = safe("SoundRegistry");
export const Spellchecker = safe("Spellchecker");
export const SyncbackCategoryTask = safe("SyncbackCategoryTask");
export const SyncbackEventTask = safe("SyncbackEventTask");
export const SyncbackMetadataTask = safe("SyncbackMetadataTask");
export const SystemStartService = safe("SystemStartService");
export const Task = safe("Task");
export const TaskFactory = safe("TaskFactory");
export const TaskQueue = safe("TaskQueue");
export const TaskQueueStatusStore = safe("TaskQueueStatusStore");
export const TaskRegistry = safe("TaskRegistry");
export const Thread = safe("Thread");
export const UndoRedoStore = safe("UndoRedoStore");
export const Utils = safe("Utils");
export const VirtualDOMUtils = safe("VirtualDOMUtils");
export const WorkspaceStore = safe("WorkspaceStore");
