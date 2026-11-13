/*
 * decaffeinate suggestions:
 * DS002: Fix invalid constructor
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS104: Avoid inline assignments
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
import PropTypes from "prop-types";
import React from "react";
import { RegExpUtils } from "nylas-exports";

class LinkEditor extends React.Component {
	static initClass() {
		LinkEditor.displayName = "LinkEditor";

		LinkEditor.propTypes = {
			// A callback function we use to save the URL to the Contenteditable
			onSaveUrl: PropTypes.func,

			// The current DOM link we are modifying
			linkToModify: PropTypes.object,

			// A callback used when a link has been cancled, completed, or escaped
			// from. Used to notify our parent to switch modes.
			onDoneWithLink: PropTypes.func,
		};
	}

	constructor(props) {
		super(props);
		let left;
		this.render = this.render.bind(this);
		this._onBlur = this._onBlur.bind(this);
		this._saveUrl = this._saveUrl.bind(this);
		this._onInputChange = this._onInputChange.bind(this);
		this._detectEscape = this._detectEscape.bind(this);
		this._saveUrlOnEnter = this._saveUrlOnEnter.bind(this);
		this._removeUrl = this._removeUrl.bind(this);
		this._initialUrl = this._initialUrl.bind(this);
		this._urlInputRef = React.createRef();
		this._removeBtnRef = React.createRef();
		this.props = props;
		this._derivedUrl = this._initialUrl();
		this.state = {
			urlInputValue: (left = this._derivedUrl) != null ? left : "",
		};
	}

	// Re-derive the field only when the link (or its href) changes, so a URL
	// being typed survives an unrelated re-render.
	componentDidUpdate(prevProps) {
		const url = this._initialUrl();
		if (
			prevProps.linkToModify !== this.props.linkToModify ||
			url !== this._derivedUrl
		) {
			this._derivedUrl = url;
			this.setState({ urlInputValue: url });
		}
	}

	componentDidMount() {
		if (this.props.focusOnMount) {
			return this._urlInputRef.current?.focus();
		}
	}

	render() {
		let widthCorrection = 32; // width of padding and leading icon space
		let checkBtn = "";
		let removeBtn = "";
		if (this._initialUrl()) {
			widthCorrection += 32;
			removeBtn = React.createElement(
				"button",
				{
					className: "btn btn-icon",
					ref: this._removeBtnRef,
					style: { float: "right" },
					onMouseDown: this._removeUrl,
				},
				React.createElement("i", { className: "fa fa-times" }),
			);
		}

		if (
			this.state.urlInputValue.length === 0 ||
			this.state.urlInputValue !== this._initialUrl()
		) {
			widthCorrection += 32;
			checkBtn = React.createElement(
				"button",
				{
					className: "btn btn-icon",
					style: { float: "right" },
					onKeyDown: this._detectEscape,
					onKeyPress: this._saveUrlOnEnter,
					onMouseDown: this._saveUrl,
				},
				React.createElement("i", { className: "fa fa-check" }),
			);
		}

		return React.createElement(
			"div",
			{ className: "toolbar-new-link" },
			React.createElement("i", { className: "fa fa-link preview-btn-icon" }),
			React.createElement("input", {
				type: "text",
				ref: this._urlInputRef,
				style: { height: 34, width: `calc(100% - ${widthCorrection}px)` },
				value: this.state.urlInputValue,
				onBlur: this._onBlur,
				onKeyDown: this._detectEscape,
				onKeyPress: this._saveUrlOnEnter,
				onChange: this._onInputChange,
				className: "floating-toolbar-input",
				placeholder: "Paste or type a link",
			}),
			removeBtn,
			checkBtn,
		);
	}

	// Clicking the save or remove buttons will take precendent over simply
	// bluring the field.
	_onBlur(event) {
		const targets = [];
		if (this._removeBtnRef.current) {
			targets.push(this._removeBtnRef.current);
		}

		if (Array.from(targets).includes(event.relatedTarget)) {
			event.preventDefault();
			return;
		} else {
			return this._saveUrl();
		}
	}

	_saveUrl() {
		if (this.state.urlInputValue.trim().length > 0) {
			this.props.onSaveUrl(this.state.urlInputValue, this.props.linkToModify);
		}
		return this.props.onDoneWithLink();
	}

	_onInputChange(event) {
		return this.setState({ urlInputValue: event.target.value });
	}

	_detectEscape(event) {
		if (event.key === "Escape") {
			return this.props.onDoneWithLink();
		}
	}

	_saveUrlOnEnter(event) {
		if (event.key === "Enter") {
			if (this.state.urlInputValue.trim().length > 0) {
				return this._saveUrl();
			} else {
				return this._removeUrl();
			}
		}
	}

	// We signify the removal of a url with an empty string. This protects us
	// from the case where people delete the url text and hit save. In that
	// case we also want to remove the link.
	_removeUrl() {
		this.setState({ urlInputValue: "" });
		this.props.onSaveUrl("", this.props.linkToModify);
		return this.props.onDoneWithLink();
	}

	_initialUrl(props) {
		let left;
		if (props == null) {
			({ props } = this);
		}
		let initialUrl =
			(left =
				props.linkToModify != null
					? props.linkToModify.getAttribute("href")
					: undefined) != null
				? left
				: "";
		if (initialUrl.length === 0) {
			const textContent =
				(props.linkToModify != null
					? props.linkToModify.textContent
					: undefined) != null
					? props.linkToModify != null
						? props.linkToModify.textContent
						: undefined
					: "";
			if (RegExpUtils.urlRegex({ matchEntireString: true }).test(textContent)) {
				initialUrl = textContent;
			}
		}

		return initialUrl;
	}
}
LinkEditor.initClass();

module.exports = LinkEditor;
