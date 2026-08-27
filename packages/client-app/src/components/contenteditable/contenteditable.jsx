/*
 * decaffeinate suggestions:
 * DS002: Fix invalid constructor
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__, or convert again using --optional-chaining
 * DS104: Avoid inline assignments
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
import PropTypes from "prop-types";
const _ = require("underscore");
const React = require("react");
const ReactDOM = require("react-dom");

const { Utils, DOMUtils } = require("nylas-exports");
const { KeyCommandsRegion } = require("nylas-component-kit");
const FloatingToolbar = require("./floating-toolbar.jsx");

const EditorAPI = require("./editor-api.js");
const ExtendedSelection = require("./extended-selection.js");

const TabManager = require("./tab-manager.js").default;
const LinkManager = require("./link-manager.js").default;
const ListManager = require("./list-manager.js").default;
const MouseService = require("./mouse-service.js").default;
const DOMNormalizer = require("./dom-normalizer.js");
const ClipboardService = require("./clipboard-service.js").default;
const BlockquoteManager = require("./blockquote-manager.js").default;
const ToolbarButtonManager = require("./toolbar-button-manager.js").default;
const EmphasisFormattingExtension =
	require("./emphasis-formatting-extension.js").default;
const ParagraphFormattingExtension =
	require("./paragraph-formatting-extension.js").default;

/*
Public: A modern React-compatible contenteditable

This <Contenteditable /> component is fully React-compatible and behaves
like a standard controlled input.

```javascript
getInitialState: function() {
  return {value: '<strong>Hello!</strong>'};
},
handleChange: function(event) {
  this.setState({value: event.target.value});
},
render: function() {
  var value = this.state.value;
  return <Contenteditable type="text" value={value} onChange={this.handleChange} />;
}
```
*/
class Contenteditable extends React.Component {
	static initClass() {
		Contenteditable.displayName = "Contenteditable";

		Contenteditable.IgnoreMutationClassName = "ignore-mutations";

		Contenteditable.propTypes = {
			// The current html state, as a string, of the contenteditable.
			value: PropTypes.string,

			// Handlers
			onChange: PropTypes.func.isRequired,
			onFilePaste: PropTypes.func,

			// A list of objects that extend {ContenteditableExtension}
			extensions: PropTypes.array,

			spellcheck: PropTypes.bool,

			floatingToolbar: PropTypes.bool,
		};

		Contenteditable.defaultProps = {
			extensions: [],
			spellcheck: true,
			floatingToolbar: true,
			onSelectionRestored: () => {},
		};

		Contenteditable.prototype.coreServices = [MouseService, ClipboardService];

		Contenteditable.prototype.coreExtensions = [
			ToolbarButtonManager,
			ListManager,
			TabManager,
			EmphasisFormattingExtension,
			ParagraphFormattingExtension,
			LinkManager,
			BlockquoteManager,
			DOMNormalizer,
		];
	}

	//#####################################################################
	//########################## Public Methods ###########################
	//#####################################################################

	/* Public: perform an editing operation on the Contenteditable

  - `editingFunction` A function to mutate the DOM and
  {ExtendedSelection}. It gets passed an {EditorAPI} object that contains
  mutating methods.

  If the current selection at the time of running the extension is out of
  scope, it will be set to the last saved state. This ensures extensions
  operate on a valid {ExtendedSelection}.

  Edits made within the editing function will eventually fire _onDOMMutated
  */
	atomicEdit(editingFunction, extraArgsObj) {
		if (extraArgsObj == null) {
			extraArgsObj = {};
		}
		this._teardownNonMutationListeners();

		const editor = new EditorAPI(this._editableNode());

		if (
			!editor.currentSelection().isInScope() &&
			extraArgsObj.methodName !== "onBlur"
		) {
			this._restoreSelection();
		}

		const argsObj = _.extend(extraArgsObj, { editor });

		try {
			editingFunction(argsObj);
		} catch (error) {
			NylasEnv.reportError(error);
		}

		return this._setupNonMutationListeners();
	}

	focus() {
		return this._editableNode().focus();
	}

	setSelection(selection) {
		this.setInnerState({
			exportedSelection: selection,
			previousExportedSelection: this.innerState.exportedSelection,
		});
		return this._restoreSelection();
	}

	//#####################################################################
	//######################### React Lifecycle ###########################
	//#####################################################################

	constructor(props) {
		super();
		this.atomicEdit = this.atomicEdit.bind(this);
		this.focus = this.focus.bind(this);
		this.setSelection = this.setSelection.bind(this);
		this.UNSAFE_componentWillMount = this.UNSAFE_componentWillMount.bind(this);
		this.componentDidMount = this.componentDidMount.bind(this);
		this.componentDidUpdate = this.componentDidUpdate.bind(this);
		this.componentWillUnmount = this.componentWillUnmount.bind(this);
		this.setInnerState = this.setInnerState.bind(this);
		this.render = this.render.bind(this);
		this._editableNode = this._editableNode.bind(this);
		this._eventHandlers = this._eventHandlers.bind(this);
		this._setupNonMutationListeners =
			this._setupNonMutationListeners.bind(this);
		this._teardownNonMutationListeners =
			this._teardownNonMutationListeners.bind(this);
		this._setupEditingActionListeners =
			this._setupEditingActionListeners.bind(this);
		this._teardownEditingActionListeners =
			this._teardownEditingActionListeners.bind(this);
		this._onDOMMutated = this._onDOMMutated.bind(this);
		this._onBlur = this._onBlur.bind(this);
		this._onFocus = this._onFocus.bind(this);
		this._onKeyDown = this._onKeyDown.bind(this);
		this._onDragOver = this._onDragOver.bind(this);
		this._onDrop = this._onDrop.bind(this);
		this._shouldAcceptDrop = this._shouldAcceptDrop.bind(this);
		this._onCompositionStart = this._onCompositionStart.bind(this);
		this._onCompositionEnd = this._onCompositionEnd.bind(this);
		this._onShowContextMenu = this._onShowContextMenu.bind(this);
		this._runCallbackOnExtensions = this._runCallbackOnExtensions.bind(this);
		this.dispatchEventToExtensions = this.dispatchEventToExtensions.bind(this);
		this._runExtensionMethod = this._runExtensionMethod.bind(this);
		this.getCurrentSelection = this.getCurrentSelection.bind(this);
		this.getPreviousSelection = this.getPreviousSelection.bind(this);
		this._saveSelection = this._saveSelection.bind(this);
		this._restoreSelection = this._restoreSelection.bind(this);
		this._notifyOfSelectionRestoration =
			this._notifyOfSelectionRestoration.bind(this);
		this.props = props;
		this.state = {};
		this.innerState = {
			dragging: false,
			doubleDown: false,
			hoveringOver: false, // see {MouseService}
			editableNode: null,
			exportedSelection: null,
			previousExportedSelection: null,
		};
		this._mutationObserver = new MutationObserver(this._onDOMMutated);
	}

	UNSAFE_componentWillMount() {
		return this._setupServices();
	}

	componentDidMount() {
		this.setInnerState({ editableNode: this._editableNode() });
		this._setupNonMutationListeners();
		this._setupEditingActionListeners();
		return this._mutationObserver.observe(
			this._editableNode(),
			this._mutationConfig(),
		);
	}

	// When we have a composition event in progress, we should not update
	// because otherwise our composition event will be blown away.
	shouldComponentUpdate(nextProps, nextState) {
		return (
			!this._inCompositionEvent &&
			(!Utils.isEqualReact(nextProps, this.props) ||
				!Utils.isEqualReact(nextState, this.state))
		);
	}

	componentDidUpdate() {
		if (this._shouldRestoreSelectionOnUpdate()) {
			this._restoreSelection();
			this._notifyOfSelectionRestoration();
		}
		this._refreshServices();
		this._setupEditingActionListeners();
		this._mutationObserver.disconnect();
		this._mutationObserver.observe(
			this._editableNode(),
			this._mutationConfig(),
		);
		return this.setInnerState({ editableNode: this._editableNode() });
	}

	componentWillUnmount() {
		this._mutationObserver.disconnect();
		this._teardownNonMutationListeners();
		this._teardownEditingActionListeners();
		return this._teardownServices();
	}

	setInnerState(innerState) {
		if (innerState == null) {
			innerState = {};
		}
		if (_.isMatch(this.innerState, innerState)) {
			return;
		}
		this.innerState = _.extend(this.innerState, innerState);
		if (this._broadcastInnerStateToToolbar) {
			if (this.refs.toolbarController != null) {
				this.refs.toolbarController.componentWillReceiveInnerProps(
					this.innerState,
				);
			}
		}
		return this._refreshServices();
	}

	_setupServices() {
		return (this._services = this.coreServices.map((Service) => {
			return new Service({
				data: {
					props: this.props,
					state: this.state,
					innerState: this.innerState,
				},
				methods: {
					setInnerState: this.setInnerState,
					dispatchEventToExtensions: this.dispatchEventToExtensions,
				},
			});
		}));
	}

	_refreshServices() {
		return Array.from(this._services).map((service) =>
			service.setData({
				props: this.props,
				state: this.state,
				innerState: this.innerState,
			}),
		);
	}

	_teardownServices() {
		return Array.from(this._services).map((service) => service.teardown());
	}

	//#####################################################################
	//############################# Render ################################
	//#####################################################################

	render() {
		return React.createElement(
			KeyCommandsRegion,
			{
				className: "contenteditable-container",
				localHandlers: this._keymapHandlers(),
			},
			this._renderFloatingToolbar(),

			React.createElement(
				"div",
				Object.assign(
					{
						className: "contenteditable no-open-link-events",
						ref: "contenteditable",
						contentEditable: true,
						spellCheck: false,
						placeholder: this.props.placeholder,
						dangerouslySetInnerHTML: { __html: this.props.value },
					},
					this._eventHandlers(),
				),
			),
		);
	}

	_renderFloatingToolbar() {
		if (!this.props.floatingToolbar) {
			return;
		}
		return React.createElement(FloatingToolbar, {
			ref: "toolbarController",
			atomicEdit: this.atomicEdit,
			extensions: this._extensions(),
		});
	}

	_editableNode() {
		return ReactDOM.findDOMNode(this.refs.contenteditable);
	}

	//#####################################################################
	//########################## Listener Setup ###########################
	//#####################################################################

	_eventHandlers() {
		let handlers = {};
		for (var service of Array.from(this._services)) {
			_.extend(handlers, service.eventHandlers());
		}

		// NOTE: See {MouseService} for more handlers
		handlers = _.extend(handlers, {
			onBlur: this._onBlur,
			onFocus: this._onFocus,
			onKeyDown: this._onKeyDown,
			onCompositionEnd: this._onCompositionEnd,
			onCompositionStart: this._onCompositionStart,
		});
		return handlers;
	}

	// This extracts extensions keymap handlers and binds them to be called
	// through `atomicEdit`. This exposes the `{editor, event}` props to any
	// keyCommandHandlers callbacks.
	_boundExtensionKeymapHandlers() {
		const keymapHandlers = {};
		this._extensions().forEach((extension) => {
			if (!_.isFunction(extension.keyCommandHandlers)) {
				return;
			}
			try {
				const extensionHandlers = extension.keyCommandHandlers.call(extension);
				return _.each(extensionHandlers, (handler, command) => {
					return (keymapHandlers[command] = (event) => {
						return this.atomicEdit(handler, { event });
					});
				});
			} catch (error) {
				return NylasEnv.reportError(error);
			}
		});
		return keymapHandlers;
	}

	// NOTE: Keymaps are now broken apart into individual extensions. See the
	// `EmphasisFormattingExtension`, `ParagraphFormattingExtension`,
	// `ListManager`, and `LinkManager` for examples of extensions listening
	// to keymaps.
	_keymapHandlers() {
		const defaultKeymaps = {};
		return _.extend(defaultKeymaps, this._boundExtensionKeymapHandlers());
	}

	_setupNonMutationListeners() {
		this._broadcastInnerStateToToolbar = true;
		document.addEventListener("selectionchange", this._saveSelection);
		return this._editableNode().addEventListener(
			"contextmenu",
			this._onShowContextMenu,
		);
	}

	_teardownNonMutationListeners() {
		this._broadcastInnerStateToToolbar = false;
		document.removeEventListener("selectionchange", this._saveSelection);
		return this._editableNode().removeEventListener(
			"contextmenu",
			this._onShowContextMenu,
		);
	}

	_setupEditingActionListeners() {
		if (
			(this.editingActionUnsubscribers != null
				? this.editingActionUnsubscribers.length
				: undefined) > 0
		) {
			for (var editingActionUnsubscriber of Array.from(
				this.editingActionUnsubscribers,
			)) {
				editingActionUnsubscriber();
			}
		}
		this.editingActionUnsubscribers = [];

		return this._extensions().forEach((ext) => {
			try {
				let left;
				const editingActions =
					(left =
						typeof ext.editingActions === "function"
							? ext.editingActions()
							: undefined) != null
						? left
						: [];
				return editingActions.forEach(({ action, callback }) => {
					return this.editingActionUnsubscribers.push(
						action.listen((actionArg) => {
							return this.atomicEdit(callback, { actionArg });
						}),
					);
				});
			} catch (error) {
				return NylasEnv.reportError(error);
			}
		});
	}

	_teardownEditingActionListeners() {
		return Array.from(this.editingActionUnsubscribers).map(
			(editingActionUnsubscriber) => editingActionUnsubscriber(),
		);
	}

	// https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver
	_mutationConfig() {
		return {
			subtree: true,
			childList: true,
			attributes: true,
			characterData: true,
			attributeOldValue: true,
			characterDataOldValue: true,
		};
	}

	//#####################################################################
	//########################## Event Handlers ###########################
	//#####################################################################

	// Every time the contents of the contenteditable DOM node change due to a user
	// action, the `_onDOMMutated` event gets fired.
	//
	// If we are in the middle of an `atomic` change transaction, we ignore
	// those changes.
	//
	// If any target element of the mutations contains `IgnoreMutationClassName` in
	// its className, we will also ignore the mutations. This is order to support
	// extensions that might imperatively want to mutate the contenteditable
	// wihtout it being due to a direct user action, i.e. without wanting to
	// trigger this callback. For example, `OverlaidComponents` will mutate the
	// dimensions of its anchor elements without the user explicitly doing so.
	//
	// At all other times we take the change, apply various filters to the
	// new content, then notify our parent that the content has been updated.
	//
	_onDOMMutated(mutations) {
		if (!mutations || !(mutations.length > 0)) {
			return;
		}

		let runCallbacks = true;
		for (var mutation of Array.from(mutations)) {
			if (
				__guard__(
					mutation.target != null ? mutation.target.className : undefined,
					(x) => x.includes(Contenteditable.IgnoreMutationClassName),
				)
			) {
				runCallbacks = false;
			}
		}

		this._mutationObserver.disconnect();
		try {
			if (this.innerState.dragging) {
				this.setInnerState({ dragging: false });
			}
			if (this.innerState.doubleDown) {
				this.setInnerState({ doubleDown: false });
			}
			this._broadcastInnerStateToToolbar = false;

			if (runCallbacks) {
				this._runCallbackOnExtensions("onContentChanged", { mutations });
			}

			// NOTE: The DOMNormalizer should be the last extension to run. This
			// will ensure that when we extract our innerHTML and re-set it during
			// the next render the contents should look identical.
			//
			// Also, remember that our selection listeners have been turned off.
			// It's very likely that one of our callbacks mutated the DOM and the
			// selection. We need to be sure to re-save the selection.
			this._saveSelection();

			this.props.onChange({
				target: { value: this._editableNode().innerHTML },
			});

			return (this._broadcastInnerStateToToolbar = true);
		} finally {
			this._mutationObserver.observe(
				this._editableNode(),
				this._mutationConfig(),
			);
		}
	}

	_onBlur(event) {
		this.setInnerState({ dragging: false });
		if (this._editableNode().parentElement.contains(event.relatedTarget)) {
			return;
		}
		return this.dispatchEventToExtensions("onBlur", event);
	}

	_onFocus(event) {
		return this.dispatchEventToExtensions("onFocus", event);
	}

	_onKeyDown(event) {
		return this.dispatchEventToExtensions("onKeyDown", event);
	}

	_onDragOver(event) {
		return this.dispatchEventToExtensions("onDragOver", event);
	}

	_onDrop(event) {
		return this.dispatchEventToExtensions("onDrop", event);
	}

	_shouldAcceptDrop(event) {
		for (var extension of Array.from(
			[].concat(this.props.extensions, this.coreExtensions),
		)) {
			if (
				extension.shouldAcceptDrop != null
					? extension.shouldAcceptDrop.call(extension, { event })
					: undefined
			) {
				return true;
			}
		}
		return false;
	}

	// We must set the `inCompositionEvent` flag in addition to tearing down
	// the selecton listeners. While the composition event is in progress, we
	// want to ignore any input events we get.
	//
	// It is also possible for a composition event to end and then
	// immediately start a new composition event. This happens when two
	// composition event-triggering characters are pressed twice in a row.
	// When the first composition event ends, the `_onDOMMutated` method fires (as
	// it's supposed to) and sends off an asynchronous update request when we
	// `_saveNewHtml`. Before that comes back via new props, the 2nd
	// composition event starts. Without the `_inCompositionEvent` flag
	// stopping the re-render, the asynchronous update request will cause us
	// to re-render and blow away our newly started 2nd composition event.
	//
	// While we're in a composition event it's important that `_onDOMMutated`
	// still get fired so the selection gets updated and the latest body
	// saved for the next render. However, we want to disable any plugins
	// since they may inadvertently kill the composition editor by mutating
	// the DOM.
	_onCompositionStart() {
		this._inCompositionEvent = true;
		return this._teardownNonMutationListeners();
	}

	_onCompositionEnd() {
		this._inCompositionEvent = false;
		return this._setupNonMutationListeners();
	}

	_onShowContextMenu(event) {
		if (this.refs.toolbarController != null) {
			this.refs.toolbarController.forceClose();
		}
		event.preventDefault();

		const { remote } = require("electron");
		const { Menu, MenuItem } = remote;

		const menu = new Menu();

		this.dispatchEventToExtensions("onShowContextMenu", event, { menu });
		menu.append(new MenuItem({ label: "Cut", role: "cut" }));
		menu.append(new MenuItem({ label: "Copy", role: "copy" }));
		menu.append(new MenuItem({ label: "Paste", role: "paste" }));
		menu.append(
			new MenuItem({
				label: "Paste and Match Style",
				role: "pasteandmatchstyle",
			}),
		);
		return menu.popup(remote.getCurrentWindow());
	}

	//#####################################################################
	//########################### Extensions ##############################
	//#####################################################################

	_extensions() {
		return this.props.extensions.concat(this.coreExtensions);
	}

	_runCallbackOnExtensions(method, argsObj) {
		if (argsObj == null) {
			argsObj = {};
		}
		return Array.from(this._extensions()).map((extension) =>
			this._runExtensionMethod(extension, method, argsObj),
		);
	}

	// Will execute the event handlers on each of the registerd and core
	// extensions In this context, event.preventDefault and
	// event.stopPropagation don't refer to stopping default DOM behavior or
	// prevent event bubbling through the DOM, but rather prevent our own
	// Contenteditable default behavior, and preventing other extensions from
	// being called. If any of the extensions calls event.preventDefault()
	// it will prevent the default behavior for the Contenteditable, which
	// basically means preventing the core extension handlers from being
	// called.  If any of the extensions calls event.stopPropagation(), it
	// will prevent any other extension handlers from being called.
	dispatchEventToExtensions(method, event, args) {
		let extension;
		if (args == null) {
			args = {};
		}
		const argsObj = _.extend(args, { event });
		for (extension of Array.from(this.props.extensions)) {
			if (event != null ? event.isPropagationStopped() : undefined) {
				break;
			}
			this._runExtensionMethod(extension, method, argsObj);
		}

		if (
			(event != null ? event.defaultPrevented : undefined) ||
			(event != null ? event.isPropagationStopped() : undefined)
		) {
			return;
		}
		return (() => {
			const result = [];
			for (extension of Array.from(this.coreExtensions)) {
				if (event != null ? event.isPropagationStopped() : undefined) {
					break;
				}
				result.push(this._runExtensionMethod(extension, method, argsObj));
			}
			return result;
		})();
	}

	_runExtensionMethod(extension, method, argsObj) {
		if (argsObj == null) {
			argsObj = {};
		}
		if (this._inCompositionEvent) {
			return;
		}
		if (extension[method] == null) {
			return;
		}
		const editingFunction = extension[method].bind(extension);
		argsObj = _.extend(argsObj, { methodName: method });
		return this.atomicEdit(editingFunction, argsObj);
	}

	//#####################################################################
	//############################ Selection ##############################
	//#####################################################################
	// Saving and restoring a selection is difficult with React.
	//
	// React only handles Input and Textarea elements:
	// https://github.com/facebook/react/blob/master/src/browser/ui/ReactInputSelection.js
	// This is because they expose a very convenient `selectionStart` and
	// `selectionEnd` integer.
	//
	// Contenteditable regions are trickier. They require the more
	// sophisticated `Range` and `Selection` APIs. We have an
	// {ExtendedSelection} class which is a wrapper around the native DOM
	// Selection API. This exposes convenience methods for manipulating the
	// Selection object.
	//
	// Range docs:
	// http://www.w3.org/TR/DOM-Level-2-Traversal-Range/ranges.html
	//
	// Selection API docs:
	// http://www.w3.org/TR/selection-api/#dfn-range
	//
	// A Contenteditable region can have arbitrary html inside of it. This
	// means that a selection start point can be some node (the `anchorNode`)
	// and its end point can be a completely different node (the `focusNode`)
	//
	// When React re-renders, all of the DOM nodes may change. They may
	// look exactly the same, but have different object references.
	//
	// This means that your old references to `anchorNode` and `focusNode`
	// may be bad and no longer in scope or painted.
	//
	// In order to restore the selection properly we need to re-find the
	// equivalent `anchorNode` and `focusNode`. Luckily we can use the
	// `isEqualNode` method to get a shallow comparison of the nodes.
	//
	// Unfortunately it's possible for `isEqualNode` to match more than one
	// node since two nodes may look very similar.
	//
	// To fix this we need to keep track of the original indices to determine
	// which node is most likely the matching one.
	//
	// http://www.w3.org/TR/selection-api/#selectstart-event

	//# TODO DEPRECATE ME: This is only necessary because Undo/Redo is still
	//part of the composer and not a core part of the Contenteditable.
	getCurrentSelection() {
		return this.innerState.exportedSelection;
	}
	getPreviousSelection() {
		return this.innerState.previousExportedSelection;
	}

	// Every time the selection changes we save its state.
	//
	// In an ideal world, the selection state, much like the body, would
	// behave like any other controlled React input: onchange we'd notify our
	// parent, they'd update our props, and we'd re-render.
	//
	// Unfortunately, Selection is not something React natively keeps track
	// of in its virtual DOM, the performance would be terrible if we
	// re-rendered on every selection change (think about dragging a
	// selection), and having every user of `<Contenteditable>` need to
	// remember to deal with, save, and set the Selection object is a pain.
	//
	// To counter this we save local instance copies of the Selection.
	//
	// First of all we wrap the native Selection object in an
	// [ExtendedSelection} object. This is a pure extension and has all
	// standard methods.
	//
	// We then save out 3 types of selections on `innerState` for us to use
	// later:
	//
	// 1. `selectionSnapshot` - This is accessed by any sub-components of
	// the Contenteditable such as the `<FloatingToolbar>` and its
	// extensions.
	//
	// It is slightly different from an `exportedSelection` in that the
	// anchorNode property points to an attached DOM reference and not the
	// clone of a node. This is necessary for extensions to be able to
	// traverse the actual current DOM from the anchorNode. The
	// `exportedSelection`'s, cloned nodes don't have parentNOdes.
	//
	// This is crucially not a reference to the `rawSelection` object,
	// because the anchorNodes of that may change from underneath us at any
	// time.
	//
	// 2. `exportedSelection` - This is an {ExportedSelection} object and is
	// used to restore the selection even after the DOM has changed. When our
	// component re-renders the actual DOM objects on the heap will be
	// different. An {ExportedSelection} contains counting indicies we use to
	// re-find the correct DOM Nodes in the new document.
	//
	// 3. `previousExportedSelection` - This is used for undo / redo so when
	// you revert to a previous state, the selection updates as well.
	_saveSelection() {
		const selection = new ExtendedSelection(this._editableNode());
		if (!(selection != null ? selection.isInScope() : undefined)) {
			return;
		}

		return this.setInnerState({
			selectionSnapshot: selection.selectionSnapshot(),
			exportedSelection: selection.exportSelection(),
			previousExportedSelection: this.innerState.exportedSelection,
		});
	}

	_restoreSelection() {
		this._teardownNonMutationListeners();
		const selection = new ExtendedSelection(this._editableNode());
		selection.importSelection(this.innerState.exportedSelection);
		if (selection.isInScope()) {
			// The bounding client rect has changed
			this.setInnerState({ editableNode: this._editableNode() });
		}
		return this._setupNonMutationListeners();
	}

	_notifyOfSelectionRestoration() {
		const selection = new ExtendedSelection(this._editableNode());
		if (selection.isInScope()) {
			return this.props.onSelectionRestored(selection, this._editableNode());
		}
	}

	// When the component updates, the selection may have changed from our
	// last known saved position. This can happen for a couple of reasons:
	//
	// 1. Some sister-component (like the LinkEditor) grabbed the selection.
	// 2. A sister-component that used to have the selection was unmounted
	// causing the selection to be null or the document
	_shouldRestoreSelectionOnUpdate() {
		return (
			!this.innerState.dragging &&
			document.activeElement === this._editableNode()
		);
	}
}
Contenteditable.initClass();

module.exports = Contenteditable;

function __guard__(value, transform) {
	return typeof value !== "undefined" && value !== null
		? transform(value)
		: undefined;
}
