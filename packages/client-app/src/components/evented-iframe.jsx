/*
 * decaffeinate suggestions:
 * DS002: Fix invalid constructor
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
import PropTypes from "prop-types";
const React = require("react");
const ReactDOM = require("react-dom");
const {
	Utils,
	RegExpUtils,
	IdentityStore,
	SearchableComponentMaker,
	SearchableComponentStore,
} = require("nylas-exports");
import IFrameSearcher from "../searchable-components/iframe-searcher.js";
const url = require("node:url");
const _ = require("underscore");

/*
Public: EventedIFrame is a thin wrapper around the DOM's standard `<iframe>` element.
You should always use EventedIFrame, because it provides important event hooks that
ensure keyboard and mouse events are properly delivered to the application when
fired within iFrames.

```
<div className="file-frame-container">
  <EventedIFrame src={src} />
  <Spinner visible={!@state.ready} />
</div>
```

Any `props` added to the <EventedIFrame> are passed to the iFrame it renders.

Section: Component Kit
*/
class EventedIFrame extends React.Component {
	constructor(...args) {
		this.render = this.render.bind(this);
		this.componentDidMount = this.componentDidMount.bind(this);
		this.componentWillUnmount = this.componentWillUnmount.bind(this);
		this.shouldComponentUpdate = this.shouldComponentUpdate.bind(this);
		this.didReplaceDocument = this.didReplaceDocument.bind(this);
		this.setHeightQuietly = this.setHeightQuietly.bind(this);
		this._onSearchableStoreChange = this._onSearchableStoreChange.bind(this);
		this._unsubscribeFromIFrameEvents =
			this._unsubscribeFromIFrameEvents.bind(this);
		this._subscribeToIFrameEvents = this._subscribeToIFrameEvents.bind(this);
		this._getContainingTarget = this._getContainingTarget.bind(this);
		this._onIFrameBlur = this._onIFrameBlur.bind(this);
		this._onIFrameFocus = this._onIFrameFocus.bind(this);
		this._onIFrameResize = this._onIFrameResize.bind(this);
		this._onIFrameClick = this._onIFrameClick.bind(this);
		this._onIFrameMouseEvent = this._onIFrameMouseEvent.bind(this);
		this._onIFrameKeyEvent = this._onIFrameKeyEvent.bind(this);
		this._onIFrameContextualMenu = this._onIFrameContextualMenu.bind(this);
		super(...args);
	}

	static initClass() {
		EventedIFrame.displayName = "EventedIFrame";

		EventedIFrame.propTypes = {
			searchable: PropTypes.bool,
			onResize: PropTypes.func,
		};
	}

	render() {
		const otherProps = Utils.fastOmit(
			this.props,
			Object.keys(this.constructor.propTypes),
		);
		return React.createElement(
			"iframe",
			Object.assign({ seamless: "seamless" }, otherProps),
		);
	}

	componentDidMount() {
		if (this.props.searchable) {
			this._regionId = Utils.generateTempId();
			this._searchUsub = SearchableComponentStore.listen(
				this._onSearchableStoreChange,
			);
			SearchableComponentStore.registerSearchRegion(
				this._regionId,
				ReactDOM.findDOMNode(this),
			);
		}
		return this._subscribeToIFrameEvents();
	}

	componentWillUnmount() {
		this._unsubscribeFromIFrameEvents();
		if (this.props.searchable) {
			this._searchUsub();
			return SearchableComponentStore.unregisterSearchRegion(this._regionId);
		}
	}

	componentDidUpdate() {
		if (this.props.searchable) {
			return SearchableComponentStore.registerSearchRegion(
				this._regionId,
				ReactDOM.findDOMNode(this),
			);
		}
	}

	shouldComponentUpdate(nextProps, nextState) {
		return (
			!Utils.isEqualReact(nextProps, this.props) ||
			!Utils.isEqualReact(nextState, this.state)
		);
	}

	/*
  Public: Call this method if you replace the contents of the iframe's document.
  This allows {EventedIframe} to re-attach it's event listeners.
  */
	didReplaceDocument() {
		this._unsubscribeFromIFrameEvents();
		return this._subscribeToIFrameEvents();
	}

	setHeightQuietly(height) {
		this._ignoreNextResize = true;
		return (ReactDOM.findDOMNode(this).height = `${height}px`);
	}

	_onSearchableStoreChange() {
		if (!this.props.searchable) {
			return;
		}
		const node = ReactDOM.findDOMNode(this);
		const doc =
			(node.contentDocument != null ? node.contentDocument.body : undefined) !=
			null
				? node.contentDocument != null
					? node.contentDocument.body
					: undefined
				: node.contentDocument;
		const searchIndex = SearchableComponentStore.getCurrentRegionIndex(
			this._regionId,
		);
		const { searchTerm } = SearchableComponentStore.getCurrentSearchData();
		if (
			this.lastSearchIndex !== searchIndex ||
			this.lastSearchTerm !== searchTerm
		) {
			IFrameSearcher.highlightSearchInDocument(
				this._regionId,
				searchTerm,
				doc,
				searchIndex,
			);
		}
		this.lastSearchIndex = searchIndex;
		return (this.lastSearchTerm = searchTerm);
	}

	_unsubscribeFromIFrameEvents() {
		const node = ReactDOM.findDOMNode(this);
		const doc = node.contentDocument;
		if (!doc) {
			return;
		}
		doc.removeEventListener("click", this._onIFrameClick);
		doc.removeEventListener("keydown", this._onIFrameKeyEvent);
		doc.removeEventListener("keypress", this._onIFrameKeyEvent);
		doc.removeEventListener("keyup", this._onIFrameKeyEvent);
		doc.removeEventListener("mousedown", this._onIFrameMouseEvent);
		doc.removeEventListener("mousemove", this._onIFrameMouseEvent);
		doc.removeEventListener("mouseup", this._onIFrameMouseEvent);
		doc.removeEventListener("contextmenu", this._onIFrameContextualMenu);
		if (node.contentWindow) {
			node.contentWindow.removeEventListener("focus", this._onIFrameFocus);
			node.contentWindow.removeEventListener("blur", this._onIFrameBlur);
			return node.contentWindow.removeEventListener(
				"resize",
				this._onIFrameResize,
			);
		}
	}

	_subscribeToIFrameEvents() {
		const node = ReactDOM.findDOMNode(this);
		const doc = node.contentDocument;
		return _.defer(() => {
			doc.addEventListener("click", this._onIFrameClick);
			doc.addEventListener("keydown", this._onIFrameKeyEvent);
			doc.addEventListener("keypress", this._onIFrameKeyEvent);
			doc.addEventListener("keyup", this._onIFrameKeyEvent);
			doc.addEventListener("mousedown", this._onIFrameMouseEvent);
			doc.addEventListener("mousemove", this._onIFrameMouseEvent);
			doc.addEventListener("mouseup", this._onIFrameMouseEvent);
			doc.addEventListener("contextmenu", this._onIFrameContextualMenu);
			if (node.contentWindow) {
				node.contentWindow.addEventListener("focus", this._onIFrameFocus);
				node.contentWindow.addEventListener("blur", this._onIFrameBlur);
				if (this.props.onResize) {
					return node.contentWindow.addEventListener(
						"resize",
						this._onIFrameResize,
					);
				}
			}
		});
	}

	_getContainingTarget(event, options) {
		let { target } = event;
		while (target != null && target !== document && target !== window) {
			if (target.getAttribute(options.with) != null) {
				return target;
			}
			target = target.parentElement;
		}
		return null;
	}

	_onIFrameBlur(_event) {
		const node = ReactDOM.findDOMNode(this);
		return node.contentWindow.getSelection().empty();
	}

	_onIFrameFocus(_event) {
		return window.getSelection().empty();
	}

	_onIFrameResize(event) {
		if (this._ignoreNextResize) {
			this._ignoreNextResize = false;
			return;
		}
		return typeof this.props.onResize === "function"
			? this.props.onResize(event)
			: undefined;
	}

	// The iFrame captures events that take place over it, which causes some
	// interesting behaviors. For example, when you drag and release over the
	// iFrame, the mouseup never fires in the parent window.
	_onIFrameClick(e) {
		e.stopPropagation();
		const target = this._getContainingTarget(e, { with: "href" });
		if (target) {
			// Sometimes urls can have relative, malformed, or malicious href
			// targets. We test the existence of a valid RFC 3986 scheme and make
			// sure the protocol isn't blacklisted. We never allow `file:` links
			// through.
			let rawHref = target.getAttribute("href");

			if (this._isBlacklistedHref(rawHref)) {
				e.preventDefault();
				return;
			}

			if (!url.parse(rawHref).protocol) {
				// Check for protocol-relative uri's
				if (new RegExp(/^\/\//).test(rawHref)) {
					target.setAttribute("href", `https:${rawHref}`);
				} else {
					target.setAttribute("href", `http://${rawHref}`);
				}

				rawHref = target.getAttribute("href");
			}

			e.preventDefault();

			// If this is a link to our billing site, attempt single sign on instead of
			// just following the link directly
			if (rawHref.startsWith(IdentityStore.URLRoot)) {
				const path = rawHref.split(IdentityStore.URLRoot).pop();
				IdentityStore.fetchSingleSignOnURL(path, {
					source: "SingleSignOnEmail",
				}).then((href) => {
					return NylasEnv.windowEventHandler.openLink({
						href,
						metaKey: e.metaKey,
					});
				});
				return;
			}

			// It's important to send the raw `href` here instead of the target.
			// The `target` comes from the document context of the iframe, which
			// as of Electron 0.36.9, has different constructor function objects
			// in memory than the main execution context. This means that code
			// like `e.target instanceof Element` will erroneously return false
			// since the `e.target.constructor` and the `Element` function are
			// created in different contexts.
			return NylasEnv.windowEventHandler.openLink({
				href: rawHref,
				metaKey: e.metaKey,
			});
		}
	}

	_isBlacklistedHref(href) {
		return new RegExp(/^file:/i).test(href);
	}

	_onIFrameMouseEvent(event) {
		const node = ReactDOM.findDOMNode(this);
		const nodeRect = node.getBoundingClientRect();

		const eventAttrs = {};
		for (var key of Array.from(Object.keys(event))) {
			if (["webkitMovementX", "webkitMovementY"].includes(key)) {
				continue;
			}
			eventAttrs[key] = event[key];
		}

		return node.dispatchEvent(
			new MouseEvent(
				event.type,
				_.extend({}, eventAttrs, {
					bubbles: true,
					clientX: event.clientX + nodeRect.left,
					clientY: event.clientY + nodeRect.top,
					pageX: event.pageX + nodeRect.left,
					pageY: event.pageY + nodeRect.top,
				}),
			),
		);
	}

	_onIFrameKeyEvent(event) {
		if (event.metaKey || event.altKey || event.ctrlKey) {
			return;
		}

		const attrs = [
			"key",
			"code",
			"location",
			"ctrlKey",
			"shiftKey",
			"altKey",
			"metaKey",
			"repeat",
			"isComposing",
			"charCode",
			"keyCode",
			"which",
		];
		const eventInit = Object.assign({ bubbles: true }, _.pick(event, attrs));
		const eventInParentDoc = new KeyboardEvent(event.type, eventInit);

		Object.defineProperty(eventInParentDoc, "which", { value: event.which });

		return ReactDOM.findDOMNode(this).dispatchEvent(eventInParentDoc);
	}

	_onIFrameContextualMenu(event) {
		// Build a standard-looking contextual menu with options like "Copy Link",
		// "Copy Image" and "Search Google for 'Bla'"
		event.preventDefault();

		const { remote, clipboard, shell, nativeImage } = require("electron");
		const { Menu, MenuItem } = remote;
		const path = require("node:path");
		const fs = require("node:fs");
		const menu = new Menu();

		// Menu actions for links
		const linkTarget = this._getContainingTarget(event, { with: "href" });
		if (linkTarget) {
			const href = linkTarget.getAttribute("href");
			if (href.startsWith("mailto")) {
				menu.append(
					new MenuItem({
						label: "Compose Message...",
						click() {
							return NylasEnv.windowEventHandler.openLink({ href });
						},
					}),
				);
				menu.append(
					new MenuItem({
						label: "Copy Email Address",
						click() {
							return clipboard.writeText(href.split("mailto:").pop());
						},
					}),
				);
			} else {
				menu.append(
					new MenuItem({
						label: "Open Link",
						click() {
							return NylasEnv.windowEventHandler.openLink({ href });
						},
					}),
				);
				menu.append(
					new MenuItem({
						label: "Copy Link Address",
						click() {
							return clipboard.writeText(href);
						},
					}),
				);
			}
			menu.append(new MenuItem({ type: "separator" }));
		}

		// Menu actions for images
		const imageTarget = this._getContainingTarget(event, { with: "src" });
		if (imageTarget) {
			const src = imageTarget.getAttribute("src");
			const srcFilename = path.basename(src);
			menu.append(
				new MenuItem({
					label: "Save Image...",
					click() {
						return NylasEnv.showSaveDialog(
							{ defaultPath: srcFilename },
							(path) => {
								if (!path) {
									return;
								}
								const oReq = new XMLHttpRequest();
								oReq.open("GET", src, true);
								oReq.responseType = "arraybuffer";
								oReq.onload = () => {
									const buffer = new Buffer(new Uint8Array(oReq.response));
									return fs.writeFile(path, buffer, (_err) =>
										shell.showItemInFolder(path),
									);
								};
								return oReq.send();
							},
						);
					},
				}),
			);
			menu.append(
				new MenuItem({
					label: "Copy Image",
					click() {
						let img = new Image();
						img.addEventListener(
							"load",
							() => {
								const canvas = document.createElement("canvas");
								canvas.width = img.width;
								canvas.height = img.height;
								canvas.getContext("2d").drawImage(imageTarget, 0, 0);
								const imageDataURL = canvas.toDataURL("image/png");
								img = nativeImage.createFromDataURL(imageDataURL);
								return clipboard.writeImage(img);
							},
							false,
						);
						return (img.src = src);
					},
				}),
			);
			menu.append(new MenuItem({ type: "separator" }));
		}

		// Menu actions for text
		let text = "";
		const selection = ReactDOM.findDOMNode(this).contentDocument.getSelection();
		if (selection.rangeCount > 0) {
			const range = selection.getRangeAt(0);
			text = range.toString();
		}
		if (!text || text.length === 0) {
			text = (linkTarget != null ? linkTarget : event.target).innerText;
		}
		text = text.trim();

		if (text.length > 0) {
			let textPreview;
			if (text.length > 45) {
				textPreview = `${text.substr(0, 42)}...`;
			} else {
				textPreview = text;
			}
			menu.append(
				new MenuItem({
					label: "Copy",
					click() {
						return clipboard.writeText(text);
					},
				}),
			);
			menu.append(
				new MenuItem({
					label: `Search Google for '${textPreview}'`,
					click() {
						return shell.openExternal(
							`https://www.google.com/search?q=${encodeURIComponent(text)}`,
						);
					},
				}),
			);
			if (process.platform === "darwin") {
				menu.append(
					new MenuItem({
						label: `Look Up '${textPreview}'`,
						click() {
							return NylasEnv.getCurrentWindow().showDefinitionForSelection();
						},
					}),
				);
			}
		}

		if (process.platform === "darwin") {
			menu.append(new MenuItem({ type: "separator" }));
		}
		// Services menu appears here automatically

		return menu.popup(remote.getCurrentWindow());
	}
}
EventedIFrame.initClass();

module.exports = EventedIFrame;
