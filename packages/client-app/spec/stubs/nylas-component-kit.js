// Test-resolution shim for nylas-component-kit: named exports are LAZY
// PROXIES over the runtime bridge getters (see nylas-exports shim).
import bridge from "../../src/global/nylas-component-kit.js";

// Components that specs render directly resolve through the vite pipeline
// (the kit's registration pass is skipped under vitest, so its prototype
// getters don't exist).
import MenuReal from "../../src/components/menu.jsx";
import RetinaImgReal from "../../src/components/retina-img.jsx";
import SpinnerReal from "../../src/components/spinner.jsx";
import FlexboxReal from "../../src/components/flexbox.jsx";
import DropZoneReal from "../../src/components/drop-zone.jsx";
import DisclosureTriangleReal from "../../src/components/disclosure-triangle.jsx";
import SwitchReal from "../../src/components/switch.jsx";
import ModalReal from "../../src/components/modal.jsx";

const lazy = (name) =>
	new Proxy(function lazyKit() {}, {
		get(_t, prop) {
			const real = bridge[name];
			if (real === undefined || real === null) return real;
			// NOTE: unbound — bound functions lose .prototype and break
			// `class X extends Proxy.get(...)` consumers (React.Component).
			const v = real[prop];
			return v;
		},
		apply(_t, _thisArg, args) {
			return bridge[name](...args);
		},
		construct(_t, args, newTarget) {
			return Reflect.construct(bridge[name], args, newTarget);
		},
		has(_t, prop) {
			return prop in (bridge[name] || {});
		},
	});

export const AttachmentItem = lazy("AttachmentItem");
export const BoldedSearchResult = lazy("BoldedSearchResult");
export const ButtonDropdown = lazy("ButtonDropdown");
export const CalendarEventPopover = lazy("CalendarEventPopover");
export const CodeSnippet = lazy("CodeSnippet");
export const ConfigPropContainer = lazy("ConfigPropContainer");
export const Contenteditable = lazy("Contenteditable");
export const DateInput = lazy("DateInput");
export const DatePicker = lazy("DatePicker");
export const DatePickerPopover = lazy("DatePickerPopover");
export const DisclosureTriangle = DisclosureTriangleReal;
export const DropZone = DropZoneReal;
export const DropdownMenu = lazy("DropdownMenu");
export const EditableList = lazy("EditableList");
export const EditableTable = lazy("EditableTable");
export const EventedIFrame = lazy("EventedIFrame");
export const FeatureUsedUpModal = lazy("FeatureUsedUpModal");
export const Flexbox = FlexboxReal;
export const FluxContainer = lazy("FluxContainer");
export const FormItem = lazy("FormItem");
export const GeneratedFieldset = lazy("GeneratedFieldset");
export const GeneratedForm = lazy("GeneratedForm");
export const HasTutorialTip = lazy("HasTutorialTip");
export const ImageAttachmentItem = lazy("ImageAttachmentItem");
export const InjectedComponent = lazy("InjectedComponent");
export const InjectedComponentSet = lazy("InjectedComponentSet");
export const KeyCommandsRegion = lazy("KeyCommandsRegion");
export const LabelColorizer = lazy("LabelColorizer");
export const ListTabular = lazy("ListTabular");
export const ListensToFluxStore = lazy("ListensToFluxStore");
export const ListensToObservable = lazy("ListensToObservable");
export const MailLabel = lazy("MailLabel");
export const Menu = MenuReal;
export const MetadataComposerToggleButton = lazy("MetadataComposerToggleButton");
export const MiniMonthView = lazy("MiniMonthView");
export const Modal = ModalReal;
export const MultiselectDropdown = lazy("MultiselectDropdown");
export const MultiselectToolbar = lazy("MultiselectToolbar");
export const Notification = lazy("Notification");
export const NylasCalendar = lazy("NylasCalendar");
export const OAuthSignInPage = lazy("OAuthSignInPage");
export const OverlaidComponents = lazy("OverlaidComponents");
export const OverlaidComposerExtension = lazy("OverlaidComposerExtension");
export const ParticipantsTextField = lazy("ParticipantsTextField");
export const Popover = lazy("Popover");
export const ResizableRegion = lazy("ResizableRegion");
export const RetinaImg = RetinaImgReal;
export const ScenarioEditor = lazy("ScenarioEditor");
export const ScrollRegion = lazy("ScrollRegion");
export const SearchBar = lazy("SearchBar");
export const Spinner = SpinnerReal;
export const Switch = SwitchReal;
export const TabGroupRegion = lazy("TabGroupRegion");
export const Table = lazy("Table");
export const TimePicker = lazy("TimePicker");
export const TokenizingTextField = lazy("TokenizingTextField");
export const UndoToast = lazy("UndoToast");
export default bridge;
export const OutlineViewItem = lazy("OutlineViewItem");
