/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
import PropTypes from "prop-types";
import Utils from "./utils";
import SimpleMDE from "simplemde";
import { React, ReactDOM, QuotedHTMLTransformer } from "nylas-exports";

// Keep a file-scope variable containing the contents of the markdown stylesheet.
// This will be embedded in the markdown preview iFrame, as well as the email body.
// The stylesheet is loaded when a preview component is first mounted.
const _markdownStylesheet = null;

const splitContents = (contents) => {
	const quoteStart = contents.search(/(<div class="gmail_quote|<signature)/i);
	if (quoteStart > 0) {
		return [contents.substr(0, quoteStart), contents.substr(quoteStart)];
	}
	return [contents, ""];
};

class MarkdownEditor extends React.Component {
	constructor(...args) {
		super(...args);
		this.componentDidMount = this.componentDidMount.bind(this);
		this.componentDidUpdate = this.componentDidUpdate.bind(this);
		this.focus = this.focus.bind(this);
		this.focusAbsoluteEnd = this.focusAbsoluteEnd.bind(this);
		this.setCurrentBodyInDOM = this.setCurrentBodyInDOM.bind(this);
		this.currentBodyInDOM = this.currentBodyInDOM.bind(this);
		this._onBodyChanged = this._onBodyChanged.bind(this);
		this._onKeyDown = this._onKeyDown.bind(this);
	}

	static initClass() {
		MarkdownEditor.displayName = "MarkdownEditor";

		MarkdownEditor.containerRequired = false;

		MarkdownEditor.contextTypes = { parentTabGroup: PropTypes.object };

		MarkdownEditor.propTypes = {
			body: PropTypes.string.isRequired,
			onBodyChanged: PropTypes.func.isRequired,
		};
	}

	componentDidMount() {
		this.mde = new SimpleMDE({
			inputStyle: "contenteditable",
			element: ReactDOM.findDOMNode(this.refs.container),
			hideIcons: ["fullscreen", "side-by-side"],
			showIcons: ["code", "table"],
			spellChecker: false,
		});
		this.mde.codemirror.on("change", this._onBodyChanged);
		this.mde.codemirror.on("keydown", this._onKeyDown);
		return this.setCurrentBodyInDOM();
	}

	componentDidUpdate(prevProps) {
		const wasEmpty = prevProps.body.length === 0;

		if (
			this.props.body !== prevProps.body &&
			this.props.body !== this.currentBodyInDOM()
		) {
			this.setCurrentBodyInDOM();
		}

		if (wasEmpty) {
			return this.mde.codemirror.execCommand("goDocEnd");
		}
	}

	focus() {
		return this.mde.codemirror.focus();
	}

	focusAbsoluteEnd() {
		this.focus();
		return this.mde.codemirror.execCommand("goDocEnd");
	}

	setCurrentBodyInDOM() {
		const [editable, uneditable] = splitContents(this.props.body);

		const uneditableEl = ReactDOM.findDOMNode(this.refs.uneditable);
		uneditableEl.innerHTML = uneditable;
		const uneditableNoticeEl = ReactDOM.findDOMNode(this.refs.uneditableNotice);
		if (Utils.getTextFromHtml(uneditable).length > 0) {
			uneditableNoticeEl.style.display = "block";
		} else {
			uneditableNoticeEl.style.display = "none";
		}

		return this.mde.value(Utils.getTextFromHtml(editable));
	}

	currentBodyInDOM() {
		const uneditableEl = ReactDOM.findDOMNode(this.refs.uneditable);
		return this.mde.value() + uneditableEl.innerHTML;
	}

	getCurrentSelection() {}

	getPreviousSelection() {}

	setSelection() {
		const container = ReactDOM.findDOMNode(this.refs.container);
		const sel = document.getSelection();
		return sel.setBaseAndExtent(container, 0, container, 0);
	}

	_onDOMMutated() {}

	_onBodyChanged() {
		return setImmediate(() => {
			const value = this.currentBodyInDOM();
			return this.props.onBodyChanged({ target: { value } });
		});
	}

	_onKeyDown(codemirror, e) {
		if (e.key === "Tab" && e.shiftKey === true) {
			const position = codemirror.cursorCoords(true, "local");
			const isAtBeginning = position.top <= 5 && position.left <= 5;
			if (isAtBeginning) {
				// TODO i'm /really/ sorry
				// Subject is at position 2 within the tab group, the focused text area
				// in this component is at position 17, so that's why we shift back 15
				// positions.
				// This will break if the dom elements between here and the subject ever
				// change
				this.context.parentTabGroup.shiftFocus(-15);
				e.preventDefault();
				return (e.codemirrorIgnore = true);
			}
		}
	}

	render() {
		// TODO sorry
		// Add style tag to disable incompatible plugins
		return (
			<div className="markdown-editor" onFocus={this.focus}>
				<style>
					{".btn-mail-merge { display:none; }"}
					{".btn-emoji { display:none; }"}
					{".btn-templates { display:none; }"}
					{".btn-scheduler { display:none; }"}
					{".btn-translate { display:none; }"}
					{".btn-send-reminder { display:none; }"}
				</style>
				<div ref="container" className="editing-region" />
				<div
					ref="uneditableNotice"
					style={{ display: "none" }}
					className="uneditable-notice"
				>
					The markdown editor does not support editing signatures or quoted
					text. Content below will be included in your message.
				</div>
				<div ref="uneditable"></div>
			</div>
		);
	}
}
MarkdownEditor.initClass();

module.exports = MarkdownEditor;
