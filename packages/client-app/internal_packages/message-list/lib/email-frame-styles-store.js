const NylasStore = require("nylas-store");

class EmailFrameStylesStore extends NylasStore {
	constructor() {
		super(...arguments);
		this.styles = this.styles.bind(this);
		this._findStyles = this._findStyles.bind(this);
		this._listenToStyles = this._listenToStyles.bind(this);
		this._unlistenToStyles = this._unlistenToStyles.bind(this);
	}

	styles() {
		if (!this._styles) {
			this._findStyles();
			this._listenToStyles();
		}
		return this._styles;
	}

	_findStyles() {
		this._styles = "";
		for (const sheet of document.querySelectorAll(
			'[source-path*="email-frame.less"]',
		)) {
			this._styles += "\n" + sheet.innerText;
		}
		this._styles = this._styles.replace(/.ignore-in-parent-frame/g, "");
		return this.trigger();
	}

	_listenToStyles() {
		const target = document.getElementsByTagName("nylas-styles")[0];
		this._mutationObserver = new MutationObserver(this._findStyles);
		return this._mutationObserver.observe(target, {
			attributes: true,
			subtree: true,
			childList: true,
		});
	}

	_unlistenToStyles() {
		return this._mutationObserver != null
			? this._mutationObserver.disconnect()
			: undefined;
	}
}

module.exports = new EmailFrameStylesStore();
