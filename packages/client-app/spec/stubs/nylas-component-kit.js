// Test-resolution shim: materializes the lazy getter exports of the
// runtime bridge so vitest static named-import analysis sees them.
// Each read is guarded: the app module graph has intentional
// model<->store cycles that only resolve lazily; a read that lands
// mid-cycle yields undefined rather than aborting the whole suite.
import bridge from "../../src/global/nylas-component-kit.js";

const safe = (name) => {
	try {
		return bridge[name];
	} catch (_e) {
		return undefined;
	}
};

export const AttachmentItem = safe("AttachmentItem");
export const BoldedSearchResult = safe("BoldedSearchResult");
export const ButtonDropdown = safe("ButtonDropdown");
export const CalendarEventPopover = safe("CalendarEventPopover");
export const CodeSnippet = safe("CodeSnippet");
export const ConfigPropContainer = safe("ConfigPropContainer");
export const Contenteditable = safe("Contenteditable");
export const DateInput = safe("DateInput");
export const DatePicker = safe("DatePicker");
export const DatePickerPopover = safe("DatePickerPopover");
export const DisclosureTriangle = safe("DisclosureTriangle");
export const DropZone = safe("DropZone");
export const DropdownMenu = safe("DropdownMenu");
export const EditableList = safe("EditableList");
export const EditableTable = safe("EditableTable");
export const EventedIFrame = safe("EventedIFrame");
export const FeatureUsedUpModal = safe("FeatureUsedUpModal");
export const Flexbox = safe("Flexbox");
export const FluxContainer = safe("FluxContainer");
export const FormItem = safe("FormItem");
export const GeneratedFieldset = safe("GeneratedFieldset");
export const GeneratedForm = safe("GeneratedForm");
export const HasTutorialTip = safe("HasTutorialTip");
export const ImageAttachmentItem = safe("ImageAttachmentItem");
export const InjectedComponent = safe("InjectedComponent");
export const InjectedComponentSet = safe("InjectedComponentSet");
export const KeyCommandsRegion = safe("KeyCommandsRegion");
export const LabelColorizer = safe("LabelColorizer");
export const ListTabular = safe("ListTabular");
export const ListensToFluxStore = safe("ListensToFluxStore");
export const ListensToObservable = safe("ListensToObservable");
export const MailLabel = safe("MailLabel");
export const Menu = safe("Menu");
export const MetadataComposerToggleButton = safe("MetadataComposerToggleButton");
export const MiniMonthView = safe("MiniMonthView");
export const Modal = safe("Modal");
export const MultiselectDropdown = safe("MultiselectDropdown");
export const MultiselectToolbar = safe("MultiselectToolbar");
export const Notification = safe("Notification");
export const NylasCalendar = safe("NylasCalendar");
export const OAuthSignInPage = safe("OAuthSignInPage");
export const OverlaidComponents = safe("OverlaidComponents");
export const OverlaidComposerExtension = safe("OverlaidComposerExtension");
export const ParticipantsTextField = safe("ParticipantsTextField");
export const Popover = safe("Popover");
export const ResizableRegion = safe("ResizableRegion");
export const RetinaImg = safe("RetinaImg");
export const ScenarioEditor = safe("ScenarioEditor");
export const ScrollRegion = safe("ScrollRegion");
export const SearchBar = safe("SearchBar");
export const Spinner = safe("Spinner");
export const Switch = safe("Switch");
export const TabGroupRegion = safe("TabGroupRegion");
export const Table = safe("Table");
export const TimePicker = safe("TimePicker");
export const TokenizingTextField = safe("TokenizingTextField");
export const UndoToast = safe("UndoToast");
