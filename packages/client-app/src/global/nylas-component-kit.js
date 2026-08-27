/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
// Publically exposed Nylas UI Components
class NylasComponentKit {
  static initClass() {
  
    this.load("Menu", 'menu');
    this.load("DropZone", 'drop-zone');
    this.load("Spinner", 'spinner');
    this.load("Switch", 'switch');
    this.loadDeprecated("Popover", 'popover', {instead: 'Actions.openPopover'});
    this.load("FixedPopover", 'fixed-popover');
    this.require("DatePickerPopover", 'date-picker-popover');
    this.load("Modal", 'modal');
    this.load("Webview", 'webview');
    this.load("FeatureUsedUpModal", 'feature-used-up-modal');
    this.load("BillingModal", 'billing-modal');
    this.load("OpenIdentityPageButton", 'open-identity-page-button');
    this.load("Flexbox", 'flexbox');
    this.load("RetinaImg", 'retina-img');
    this.load("SwipeContainer", 'swipe-container');
    this.load("FluxContainer", 'flux-container');
    this.load("FocusContainer", 'focus-container');
    this.load("SyncingListState", 'syncing-list-state');
    this.load("EmptyListState", 'empty-list-state');
    this.load("ListTabular", 'list-tabular');
    this.load("Notification", 'notification');
    this.load("NylasCalendar", 'nylas-calendar/nylas-calendar');
    this.load("MiniMonthView", 'nylas-calendar/mini-month-view');
    this.load("CalendarEventPopover", 'nylas-calendar/calendar-event-popover');
    this.load("EventedIFrame", 'evented-iframe');
    this.load("ButtonDropdown", 'button-dropdown');
    this.load("Contenteditable", 'contenteditable/contenteditable');
    this.load("MultiselectList", 'multiselect-list');
    this.load("BoldedSearchResult", 'bolded-search-result');
    this.load("MultiselectDropdown", "multiselect-dropdown");
    this.load("KeyCommandsRegion", 'key-commands-region');
    this.load("TabGroupRegion", 'tab-group-region');
    this.load("InjectedComponent", 'injected-component');
    this.load("TokenizingTextField", 'tokenizing-text-field');
    this.load("ParticipantsTextField", 'participants-text-field');
    this.loadDeprecated("MultiselectActionBar", 'multiselect-action-bar', {instead: 'MultiselectToolbar'});
    this.load("MultiselectToolbar", 'multiselect-toolbar');
    this.load("InjectedComponentSet", 'injected-component-set');
    this.load("MetadataComposerToggleButton", 'metadata-composer-toggle-button');
    this.load("ConfigPropContainer", "config-prop-container");
    this.load("DisclosureTriangle", "disclosure-triangle");
    this.load("EditableList", "editable-list");
    this.load("OutlineViewItem", "outline-view-item");
    this.load("OutlineView", "outline-view");
    this.load("DateInput", "date-input");
    this.load("DatePicker", "date-picker");
    this.load("TimePicker", "time-picker");
    this.load("Table", "table/table");
    this.loadFrom("TableRow", "table/table");
    this.loadFrom("TableCell", "table/table");
    this.load("SelectableTable", "selectable-table");
    this.loadFrom("SelectableTableRow", "selectable-table");
    this.loadFrom("SelectableTableCell", "selectable-table");
    this.load("EditableTable", "editable-table");
    this.loadFrom("EditableTableCell", "editable-table");
    this.load("Toast", "toast");
    this.load("UndoToast", "undo-toast");
    this.load("LazyRenderedList", "lazy-rendered-list");
    this.load("OverlaidComponents", "overlaid-components/overlaid-components");
    this.load("OverlaidComposerExtension", "overlaid-components/overlaid-composer-extension");
    this.load("OAuthSignInPage", "oauth-signin-page");
    this.requireFrom("AttachmentItem", "attachment-items");
    this.requireFrom("ImageAttachmentItem", "attachment-items");
    this.load("CodeSnippet", "code-snippet");
    this.load("DropdownMenu", "dropdown-menu");
  
    this.load("ScrollRegion", 'scroll-region');
    this.load("ResizableRegion", 'resizable-region');
  
    this.loadFrom("MailLabel", "mail-label");
    this.loadFrom("LabelColorizer", "mail-label");
    this.load("MailLabelSet", "mail-label-set");
    this.load("MailImportantIcon", 'mail-important-icon');
  
    this.loadFrom("FormItem", "generated-form");
    this.loadFrom("GeneratedForm", "generated-form");
    this.loadFrom("GeneratedFieldset", "generated-form");
  
    this.load("ScenarioEditor", 'scenario-editor');
  
    this.load("SearchBar", 'search-bar');
  
    // Higher order components
    this.load("ListensToObservable", 'decorators/listens-to-observable');
    this.load("ListensToFluxStore", 'decorators/listens-to-flux-store');
    this.load("ListensToMovementKeys", 'decorators/listens-to-movement-keys');
    this.load("HasTutorialTip", 'decorators/has-tutorial-tip');
  }

  static default(requireValue) { return requireValue.default != null ? requireValue.default : requireValue; }

  static load(prop, path) {
    return Object.defineProperty(this.prototype, prop, {
      get() {
        return NylasComponentKit.default(require(`../components/${path}`));
      }
    }
    );
  }

  // We use require to load the component immediately (instead of lazy loading)
  // to improve visible latency,
  // Sometimes a component won't be loaded until the user performs an action
  // (e.g. opening a popover), so we don't want to wait until that happens to load the
  // component. In our example, the popover would take a long time to open the first time
  // if it was lazy loaded
  static require(prop, path) {
    const exported = NylasComponentKit.default(require(`../components/${path}`));
    return Object.defineProperty(this.prototype, prop,
      {get() { return exported; }});
  }

  static requireFrom(prop, path) {
    const exported = require(`../components/${path}`);
    return Object.defineProperty(this.prototype, prop,
      {get() { return exported[prop]; }});
  }

  static loadFrom(prop, path) {
    return Object.defineProperty(this.prototype, prop, {
      get() {
        const exported = require(`../components/${path}`);
        return exported[prop];
      }
    });
  }

  static loadDeprecated(prop, path, param) {
    if (param == null) { param = {}; }
    const {instead} = param;
    const {deprecate} = require('../deprecate-utils');
    return Object.defineProperty(this.prototype, prop, {
      get: deprecate(prop, instead, this, function() {
        const exported = NylasComponentKit.default(require(`../components/${path}`));
        return exported;
      }),
      enumerable: true
    }
    );
  }
}
NylasComponentKit.initClass();

module.exports = new NylasComponentKit();
