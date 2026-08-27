/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
let StyleManager;
const fs = require("fs-plus");
const path = require("path");
const { Emitter, Disposable } = require("event-kit");

// Extended: A singleton instance of this class available via `NylasEnv.styles`,
// which you can use to globally query and observe the set of active style
// sheets. The `StyleManager` doesn't add any style elements to the DOM on its
// own, but is instead subscribed to by individual `<nylas-styles>` elements,
// which clone and attach style elements in different contexts.
module.exports = StyleManager = class StyleManager {
	constructor() {
		this.emitter = new Emitter();
		this.styleElements = [];
		this.styleElementsBySourcePath = {};
	}

	/*
  Section: Event Subscription
  */

	// Extended: Invoke `callback` for all current and future style elements.
	//
	// * `callback` {Function} that is called with style elements.
	//   * `styleElement` An `HTMLStyleElement` instance. The `.sheet` property
	//     will be null because this element isn't attached to the DOM. If you want
	//     to attach this element to the DOM, be sure to clone it first by calling
	//     `.cloneNode(true)` on it. The style element will also have the following
	//     non-standard properties:
	//     * `sourcePath` A {String} containing the path from which the style
	//       element was loaded.
	//     * `context` A {String} indicating the target context of the style
	//       element.
	//
	// Returns a {Disposable} on which `.dispose()` can be called to cancel the
	// subscription.
	observeStyleElements(callback) {
		for (var styleElement of Array.from(this.getStyleElements())) {
			callback(styleElement);
		}
		return this.onDidAddStyleElement(callback);
	}

	// Extended: Invoke `callback` when a style element is added.
	//
	// * `callback` {Function} that is called with style elements.
	//   * `styleElement` An `HTMLStyleElement` instance. The `.sheet` property
	//     will be null because this element isn't attached to the DOM. If you want
	//     to attach this element to the DOM, be sure to clone it first by calling
	//     `.cloneNode(true)` on it. The style element will also have the following
	//     non-standard properties:
	//     * `sourcePath` A {String} containing the path from which the style
	//       element was loaded.
	//     * `context` A {String} indicating the target context of the style
	//       element.
	//
	// Returns a {Disposable} on which `.dispose()` can be called to cancel the
	// subscription.
	onDidAddStyleElement(callback) {
		return this.emitter.on("did-add-style-element", callback);
	}

	// Extended: Invoke `callback` when a style element is removed.
	//
	// * `callback` {Function} that is called with style elements.
	//   * `styleElement` An `HTMLStyleElement` instance.
	//
	// Returns a {Disposable} on which `.dispose()` can be called to cancel the
	// subscription.
	onDidRemoveStyleElement(callback) {
		return this.emitter.on("did-remove-style-element", callback);
	}

	// Extended: Invoke `callback` when an existing style element is updated.
	//
	// * `callback` {Function} that is called with style elements.
	//   * `styleElement` An `HTMLStyleElement` instance. The `.sheet` property
	//      will be null because this element isn't attached to the DOM. The style
	//      element will also have the following non-standard properties:
	//     * `sourcePath` A {String} containing the path from which the style
	//       element was loaded.
	//     * `context` A {String} indicating the target context of the style
	//       element.
	//
	// Returns a {Disposable} on which `.dispose()` can be called to cancel the
	// subscription.
	onDidUpdateStyleElement(callback) {
		return this.emitter.on("did-update-style-element", callback);
	}

	/*
  Section: Reading Style Elements
  */

	// Extended: Get all loaded style elements.
	getStyleElements() {
		return this.styleElements.slice();
	}

	addStyleSheet(source, params) {
		let styleElement, updated;
		const sourcePath = params != null ? params.sourcePath : undefined;
		const context = params != null ? params.context : undefined;
		const priority = params != null ? params.priority : undefined;

		if (
			sourcePath != null &&
			(styleElement = this.styleElementsBySourcePath[sourcePath])
		) {
			updated = true;
		} else {
			styleElement = document.createElement("style");
			if (sourcePath != null) {
				styleElement.sourcePath = sourcePath;
				styleElement.setAttribute("source-path", sourcePath);
			}

			if (context != null) {
				styleElement.context = context;
				styleElement.setAttribute("context", context);
			}

			if (priority != null) {
				styleElement.priority = priority;
				styleElement.setAttribute("priority", priority);
			}
		}

		styleElement.textContent = source;

		if (updated) {
			this.emitter.emit("did-update-style-element", styleElement);
		} else {
			this.addStyleElement(styleElement);
		}

		return new Disposable(() => this.removeStyleElement(styleElement));
	}

	addStyleElement(styleElement) {
		let insertIndex;
		const { sourcePath, priority } = styleElement;

		if (priority != null) {
			for (let index = 0; index < this.styleElements.length; index++) {
				var existingElement = this.styleElements[index];
				if (existingElement.priority > priority) {
					insertIndex = index;
					break;
				}
			}
		}

		if (insertIndex == null) {
			insertIndex = this.styleElements.length;
		}

		this.styleElements.splice(insertIndex, 0, styleElement);
		if (sourcePath != null) {
			if (this.styleElementsBySourcePath[sourcePath] == null) {
				this.styleElementsBySourcePath[sourcePath] = styleElement;
			}
		}
		return this.emitter.emit("did-add-style-element", styleElement);
	}

	removeStyleElement(styleElement) {
		const index = this.styleElements.indexOf(styleElement);
		if (index !== -1) {
			this.styleElements.splice(index, 1);
			if (styleElement.sourcePath != null) {
				delete this.styleElementsBySourcePath[styleElement.sourcePath];
			}
			return this.emitter.emit("did-remove-style-element", styleElement);
		}
	}

	getSnapshot() {
		return this.styleElements.slice();
	}

	restoreSnapshot(styleElementsToRestore) {
		let styleElement;
		for (styleElement of Array.from(this.getStyleElements())) {
			if (!Array.from(styleElementsToRestore).includes(styleElement)) {
				this.removeStyleElement(styleElement);
			}
		}

		const existingStyleElements = this.getStyleElements();
		return (() => {
			const result = [];
			for (styleElement of Array.from(styleElementsToRestore)) {
				if (!Array.from(existingStyleElements).includes(styleElement)) {
					result.push(this.addStyleElement(styleElement));
				} else {
					result.push(undefined);
				}
			}
			return result;
		})();
	}
};
