/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS104: Avoid inline assignments
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
const { Emitter, CompositeDisposable } = require("event-kit");

class StylesElement extends HTMLElement {
	static initClass() {
		StylesElement.prototype.subscriptions = null;
		StylesElement.prototype.context = null;
	}

	onDidAddStyleElement(callback) {
		return this.emitter.on("did-add-style-element", callback);
	}

	onDidRemoveStyleElement(callback) {
		return this.emitter.on("did-remove-style-element", callback);
	}

	onDidUpdateStyleElement(callback) {
		return this.emitter.on("did-update-style-element", callback);
	}

	createdCallback() {
		this.emitter = new Emitter();
		return (this.styleElementClonesByOriginalElement = new WeakMap());
	}

	attachedCallback() {
		return this.initialize();
	}

	detachedCallback() {
		this.subscriptions.dispose();
		return (this.subscriptions = null);
	}

	attributeChangedCallback(attrName, _oldVal, _newVal) {
		if (attrName === "context") {
			return this.contextChanged();
		}
	}

	initialize() {
		let left;
		if (this.subscriptions != null) {
			return;
		}

		this.subscriptions = new CompositeDisposable();
		this.context =
			(left = this.getAttribute("context")) != null ? left : undefined;

		this.subscriptions.add(
			NylasEnv.styles.observeStyleElements(this.styleElementAdded.bind(this)),
		);
		this.subscriptions.add(
			NylasEnv.styles.onDidRemoveStyleElement(
				this.styleElementRemoved.bind(this),
			),
		);
		return this.subscriptions.add(
			NylasEnv.styles.onDidUpdateStyleElement(
				this.styleElementUpdated.bind(this),
			),
		);
	}

	contextChanged() {
		if (this.subscriptions == null) {
			return;
		}

		for (var child of Array.from(Array.prototype.slice.call(this.children))) {
			this.styleElementRemoved(child);
		}
		this.context = this.getAttribute("context");
		return Array.from(NylasEnv.styles.getStyleElements()).map((styleElement) =>
			this.styleElementAdded(styleElement),
		);
	}

	styleElementAdded(styleElement) {
		let insertBefore;
		if (!this.styleElementMatchesContext(styleElement)) {
			return;
		}

		const styleElementClone = styleElement.cloneNode(true);
		styleElementClone.sourcePath = styleElement.sourcePath;
		styleElementClone.context = styleElement.context;
		styleElementClone.priority = styleElement.priority;
		this.styleElementClonesByOriginalElement.set(
			styleElement,
			styleElementClone,
		);

		const { priority } = styleElement;
		if (priority != null) {
			for (var child of Array.from(this.children)) {
				if (child.priority > priority) {
					insertBefore = child;
					break;
				}
			}
		}

		this.insertBefore(styleElementClone, insertBefore);
		return this.emitter.emit("did-add-style-element", styleElementClone);
	}

	styleElementRemoved(styleElement) {
		let left;
		if (!this.styleElementMatchesContext(styleElement)) {
			return;
		}

		const styleElementClone =
			(left = this.styleElementClonesByOriginalElement.get(styleElement)) !=
			null
				? left
				: styleElement;
		styleElementClone.remove();
		return this.emitter.emit("did-remove-style-element", styleElementClone);
	}

	styleElementUpdated(styleElement) {
		if (!this.styleElementMatchesContext(styleElement)) {
			return;
		}

		const styleElementClone =
			this.styleElementClonesByOriginalElement.get(styleElement);
		styleElementClone.textContent = styleElement.textContent;
		return this.emitter.emit("did-update-style-element", styleElementClone);
	}

	styleElementMatchesContext(styleElement) {
		return this.context == null || styleElement.context === this.context;
	}
}
StylesElement.initClass();

module.exports = StylesElement = document.registerElement("nylas-styles", {
	prototype: StylesElement.prototype,
});
