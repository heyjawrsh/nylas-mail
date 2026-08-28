/*
 * decaffeinate suggestions:
 * DS002: Fix invalid constructor
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__, or convert again using --optional-chaining
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
import PropTypes from "prop-types";
import _ from "underscore";
import classNames from "classnames";
import React from "react";
import ReactDOM from "react-dom";
import { Utils } from "nylas-exports";
import DatePicker from "./date-picker.jsx";
import TabGroupRegion from "./tab-group-region.jsx";

const idPropType = PropTypes.oneOfType([PropTypes.string, PropTypes.number]);

// The FormItem acts like a React controlled input.
// The `value` will set the "value" of whatever type of form item it is.
// The `onChange` handler will get passed this item's unique index (so
// parents can lookup and change the data appropriately) and the new value.
// Either direct parents, grandparents, etc are responsible for updating
// the `value` prop to update the value again.
class FormItem extends React.Component {
	constructor(...args) {
		super(...args);
		this.render = this.render.bind(this);
		this.shouldComponentUpdate = this.shouldComponentUpdate.bind(this);
		this._renderError = this._renderError.bind(this);
		this._isDisabled = this._isDisabled.bind(this);
		this._renderInput = this._renderInput.bind(this);
	}

	static initClass() {
		FormItem.displayName = "FormItem";

		FormItem.inputElementTypes = {
			checkbox: true,
			color: true,
			date: false, // We use Nylas DatePicker instead
			datetime: true,
			"datetime-local": true,
			email: true,
			file: true,
			hidden: true,
			month: true,
			number: true,
			password: true,
			radio: true,
			range: true,
			search: true,
			tel: true,
			text: true,
			time: true,
			url: true,
			week: true,
		};

		FormItem.propTypes = {
			// Some sort of unique identifier
			id: idPropType.isRequired,

			// Either a type of input or any type that can be passed into
			// `React.createElement(type, ...)`
			type: PropTypes.string.isRequired,

			// The name as POSTed to the eventual endpoint.
			name: PropTypes.string,

			// The human-readable display label for the formItem
			label: PropTypes.node,

			// Most input types take strings, numbers, and bools. Some types (like
			// "reference" can get passed arrays)
			value: PropTypes.oneOfType([
				PropTypes.string,
				PropTypes.number,
				PropTypes.bool,
			]),
			defaultValue: PropTypes.string,

			// A function that takes two arguments:
			//   - The id of this FormItem
			//   - The new value of the FormItem
			onChange: PropTypes.func,

			// FormItems can either explicitly set the disabled state, or determine
			// the disabled state by whether or not this is a 'new' or 'update'
			// form.
			formType: PropTypes.oneOf(["new", "update"]),
			disabled: PropTypes.bool,
			editableForNew: PropTypes.bool,
			editableForUpdate: PropTypes.bool,

			formItemError: PropTypes.shape({
				id: idPropType, // The formItemId
				message: PropTypes.string,
			}),

			// selectOptions
			// An array of options.
			selectOptions: PropTypes.arrayOf(
				PropTypes.shape({
					label: PropTypes.node,
					value: PropTypes.string,
				}),
			),

			// Common <input> props.
			// Anything that can be passed into a standard React <input> item will
			// be passed along. Here are some common ones. There can be many more
			multiple: PropTypes.bool,
			required: PropTypes.bool,
			prefilled: PropTypes.bool,
			maxlength: PropTypes.number,
			placeholder: PropTypes.node,
			tabIndex: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),

			//### Used by "reference" type objects
			customComponent: PropTypes.func,
			contextData: PropTypes.object,
			referenceTo: PropTypes.oneOfType([PropTypes.array, PropTypes.string]),
			referenceType: PropTypes.oneOf([
				"belongsTo",
				"hasMany",
				"hasManyThrough",
			]),
			referenceThrough: PropTypes.string,

			currentFormValues: PropTypes.object,
		};
	}

	render() {
		const classes = classNames({
			prefilled: this.props.prefilled,
			"form-item": true,
			invalid: !this._isValid(),
			valid: this._isValid(),
		});

		let { label } = this.props;
		if (this.props.required) {
			label = React.createElement(
				"strong",
				null,
				React.createElement("span", { className: "required" }, "*"),
				this.props.label,
			);
		}

		if (this.props.type === "hidden") {
			return this._renderInput();
		} else {
			return React.createElement(
				"div",
				{ className: classes, ref: "inputWrap" },
				React.createElement(
					"div",
					{ className: "label-area" },
					React.createElement("label", { htmlFor: this.props.id }, label),
				),
				React.createElement(
					"div",
					{ className: "input-area" },
					this._renderInput(),
					this._renderError(),
				),
			);
		}
	}

	shouldComponentUpdate(nextProps) {
		return !Utils.isEqualReact(nextProps, this.props);
	}

	componentDidUpdate(prevProps) {
		if (!prevProps.formItemError && !this._isValid()) {
			return ReactDOM.findDOMNode(this.refs.inputWrap).scrollIntoView(true);
		}
	}

	_isValid() {
		return !this.props.formItemError;
	}

	_renderError() {
		if (this._isValid()) {
			return false;
		}
		const msg = this.props.formItemError.message;
		return React.createElement("div", { className: "form-error" }, msg);
	}

	_isDisabled() {
		return (
			this.props.disabled ||
			(this.props.formType === "new" && this.props.editableForNew === false) ||
			(this.props.formType === "update" &&
				this.props.editableForUpdate === false)
		);
	}

	_renderInput() {
		const inputProps = _.extend({}, this.props, {
			ref: "input",
			onChange: (eventOrValue) => {
				return this.props.onChange(
					this.props.id,
					__guard__(
						eventOrValue != null ? eventOrValue.target : undefined,
						(x) => x.value,
					) != null
						? __guard__(
								eventOrValue != null ? eventOrValue.target : undefined,
								(x) => x.value,
							)
						: eventOrValue,
				);
			},
		});

		if (this._isDisabled()) {
			inputProps.disabled = true;
		}

		if (FormItem.inputElementTypes[this.props.type]) {
			return React.createElement("input", inputProps);
		} else if (this.props.type === "select") {
			const options = (
				this.props.selectOptions != null ? this.props.selectOptions : []
			).map((optionData) =>
				React.createElement(
					"option",
					Object.assign({}, optionData, {
						key: `${Utils.generateTempId()}-optionData.value`,
					}),
					optionData.label,
				),
			);
			options.unshift(
				React.createElement("option", {
					key: `${Utils.generateTempId()}-blank-option`,
				}),
			);
			return React.createElement(
				"select",
				Object.assign({}, inputProps),
				options,
			);
		} else if (this.props.type === "textarea") {
			return React.createElement("textarea", inputProps);
		} else if (this.props.type === "date") {
			inputProps.dateFormat = "YYYY-MM-DD";
			return React.createElement(DatePicker, inputProps);
		} else if (this.props.type === "EmptySpace") {
			return React.createElement("div", { className: "empty-space" });
		} else if (_.isFunction(this.props.customComponent)) {
			return React.createElement(this.props.customComponent, inputProps);
		} else {
			return console.warn(
				`We do not support type ${this.props.type} with attributes:`,
				inputProps,
			);
		}
	}
}
FormItem.initClass();

class GeneratedFieldset extends React.Component {
	constructor(...args) {
		super(...args);
		this.render = this.render.bind(this);
		this.shouldComponentUpdate = this.shouldComponentUpdate.bind(this);
		this._renderHeader = this._renderHeader.bind(this);
		this._renderFormItems = this._renderFormItems.bind(this);
		this._propsFromFormItemData = this._propsFromFormItemData.bind(this);
		this._onChangeItem = this._onChangeItem.bind(this);
		this._renderFooter = this._renderFooter.bind(this);
	}

	static initClass() {
		GeneratedFieldset.displayName = "GeneratedFieldset";

		GeneratedFieldset.propTypes = {
			// Some sort of unique identifier
			id: idPropType.isRequired,

			formItems: PropTypes.arrayOf(
				PropTypes.shape(
					_.extend(FormItem.propTypes, {
						row: PropTypes.number,
						column: PropTypes.number,
					}),
				),
			),

			// The key is the formItem id, the value is the error object
			formItemErrors: PropTypes.arrayOf(FormItem.propTypes.formItemError),

			// A function that takes two arguments:
			//   - The id of this GeneratedFieldset
			//   - A new array of updated formItems with the correct value.
			onChange: PropTypes.func,

			heading: PropTypes.node,
			useHeading: PropTypes.bool,
			formType: PropTypes.oneOf(["new", "update"]),
			zIndex: PropTypes.number,

			lastFieldset: PropTypes.bool,
			firstFieldset: PropTypes.bool,
			contextData: PropTypes.object,

			currentFormValues: PropTypes.object,
		};
	}

	render() {
		const classStr = classNames({
			"first-fieldset": this.props.firstFieldset,
			"last-fieldset": this.props.lastFieldset,
		});

		return React.createElement(
			"fieldset",
			{
				style: { zIndex: this.props.zIndex != null ? this.props.zIndex : 0 },
				className: classStr,
			},
			this._renderHeader(),
			React.createElement(
				"div",
				{ className: "fieldset-form-items" },
				this._renderFormItems(),
			),
			this._renderFooter(),
		);
	}

	shouldComponentUpdate(nextProps) {
		return !Utils.isEqualReact(nextProps, this.props);
	}

	_renderHeader() {
		if (this.props.useHeading) {
			return React.createElement(
				"header",
				null,
				React.createElement("legend", null, this.props.heading),
			);
		} else {
			return React.createElement("div", null);
		}
	}

	_renderFormItems() {
		const byRow = _.groupBy(this.props.formItems, "row");
		return _.map(byRow, (itemsInRow, rowNum) => {
			if (itemsInRow == null) {
				itemsInRow = [];
			}
			const byCol = _.groupBy(itemsInRow, "column");
			const numCols = Math.max.apply(null, Object.keys(byCol));

			const style = { zIndex: 1000 - rowNum };
			const allHidden = _.every(itemsInRow, (item) => item.type === "hidden");
			if (allHidden) {
				style.display = "none";
			}

			return React.createElement(
				"div",
				{ className: "row", "data-row-num": rowNum, style: style, key: rowNum },
				_.map(byCol, (itemsInCol, colNum) => {
					if (itemsInCol == null) {
						itemsInCol = [];
					}
					const colEls = [
						React.createElement(
							"div",
							{ className: "column", "data-col-num": colNum, key: colNum },
							itemsInCol.map((formItemData) => {
								const props = this._propsFromFormItemData(formItemData);
								return React.createElement(
									FormItem,
									Object.assign({}, props, {
										ref: `form-item-${formItemData.id}`,
									}),
								);
							}),
						),
					];
					if (colNum !== numCols - 1) {
						colEls.push(
							React.createElement("div", {
								className: "column-spacer",
								"data-col-num": `${colNum}-spacer`,
								key: `${colNum}-spacer`,
							}),
						);
					}
					return colEls;
				}),
			);
		});
	}

	// Given the raw data of an individual FormItem, prepare a set of props
	// to pass down into the FormItem.
	_propsFromFormItemData(formItemData) {
		const props = _.clone(formItemData);
		props.key = props.id;
		const error =
			this.props.formItemErrors != null
				? this.props.formItemErrors[props.id]
				: undefined;
		if (error) {
			props.formItemError = error;
		}
		props.onChange = _.bind(this._onChangeItem, this);
		props.formType = this.props.formType;
		props.contextData = this.props.contextData;
		props.currentFormValues = this.props.currentFormValues;
		return props;
	}

	_onChangeItem(itemId, newValue) {
		const newFormItems = _.map(this.props.formItems, (formItem) => {
			if (formItem.id === itemId) {
				const newFormItem = _.clone(formItem);
				newFormItem.value = newValue;
				return newFormItem;
			} else {
				return formItem;
			}
		});
		return this.props.onChange(this.props.id, newFormItems);
	}

	_renderFooter() {
		return React.createElement("footer", null);
	}
}
GeneratedFieldset.initClass();

class GeneratedForm extends React.Component {
	constructor(...args) {
		super(...args);
		this.render = this.render.bind(this);
		this.shouldComponentUpdate = this.shouldComponentUpdate.bind(this);
		this._onKeyDown = this._onKeyDown.bind(this);
		this._renderPrefilledMessage = this._renderPrefilledMessage.bind(this);
		this._renderHeaderFormError = this._renderHeaderFormError.bind(this);
		this._renderFieldsets = this._renderFieldsets.bind(this);
		this._currentFormValues = this._currentFormValues.bind(this);
		this._propsFromFieldsetData = this._propsFromFieldsetData.bind(this);
		this._onChangeFieldset = this._onChangeFieldset.bind(this);
	}

	static initClass() {
		GeneratedForm.displayName = "GeneratedForm";

		GeneratedForm.propTypes = {
			// Some sort of unique identifier
			id: idPropType,

			errors: PropTypes.shape({
				formError: PropTypes.shape({
					message: PropTypes.string,
					location: PropTypes.string, // Can be "header" (default) or "footer"
				}),
				formItemErrors: GeneratedFieldset.propTypes.formItemErrors,
			}),

			fieldsets: PropTypes.arrayOf(
				PropTypes.shape(GeneratedFieldset.propTypes),
			),

			// A function whose argument is a new set of Props
			onChange: PropTypes.func.isRequired,

			onSubmit: PropTypes.func.isRequired,

			style: PropTypes.object,

			formType: PropTypes.oneOf(["new", "update"]),
			prefilled: PropTypes.bool,
			contextData: PropTypes.object,
		};

		GeneratedForm.defaultProps = {
			style: {},
			onSubmit() {},
		};
	}

	render() {
		const submitText = this.props.formType === "new" ? "Create" : "Update";
		return React.createElement(
			"form",
			{
				className: "generated-form",
				ref: "form",
				style: this.props.style,
				onSubmit: this.props.onSubmit,
				onKeyDown: this._onKeyDown,
				noValidate: true,
			},
			React.createElement(
				TabGroupRegion,
				null,
				this._renderHeaderFormError(),
				this._renderPrefilledMessage(),
				React.createElement(
					"div",
					{ className: "fieldsets" },
					this._renderFieldsets(),
				),
				React.createElement(
					"div",
					{ className: "form-footer" },
					React.createElement(
						"button",
						{
							type: "button",
							className: "btn btn-emphasis",
							onClick: this.props.onSubmit,
						},
						submitText,
					),
				),
			),
		);
	}

	shouldComponentUpdate(nextProps) {
		return !Utils.isEqualReact(nextProps, this.props);
	}

	componentDidUpdate(prevProps) {
		if (
			!(prevProps.errors != null ? prevProps.errors.formError : undefined) &&
			(this.props.errors != null ? this.props.errors.formError : undefined)
		) {
			return ReactDOM.findDOMNode(this.refs.formHeaderError).scrollIntoView(
				true,
			);
		}
	}

	_onKeyDown(event) {
		if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
			return this.props.onSubmit(event);
		}
	}

	_renderPrefilledMessage() {
		if (this.props.prefilled) {
			return React.createElement(
				"div",
				{ className: "prefilled-message" },
				`\
The `,
				React.createElement(
					"span",
					{ className: "highlighted" },
					"highlighted",
				),
				` fields have been prefilled for you!\
`,
			);
		}
	}

	_renderHeaderFormError() {
		if (this.props.errors != null ? this.props.errors.formError : undefined) {
			return React.createElement(
				"div",
				{ ref: "formHeaderError", className: "form-error form-header-error" },
				this.props.errors.formError.message,
			);
		} else {
			return false;
		}
	}

	_renderFieldsets() {
		return (this.props.fieldsets != null ? this.props.fieldsets : []).map(
			(fieldset, i) => {
				const props = this._propsFromFieldsetData(fieldset);
				props.zIndex = 100 - i;
				props.contextData = this.props.contextData;
				props.currentFormValues = this._currentFormValues();
				props.firstFieldset = i === 0;
				props.lastFieldset = i !== 0 && i === this.props.fieldsets.length - 1;
				return React.createElement(
					GeneratedFieldset,
					Object.assign({}, props, { ref: `fieldset-${fieldset.id}` }),
				);
			},
		);
	}

	_currentFormValues() {
		const vals = {};
		for (var fieldset of Array.from(this.props.fieldsets)) {
			for (var formItem of Array.from(fieldset.formItems)) {
				vals[formItem.name] = formItem.value;
			}
		}
		return vals;
	}

	_propsFromFieldsetData(fieldsetData) {
		const props = _.clone(fieldsetData);
		const errors =
			this.props.errors != null ? this.props.errors.formItemErrors : undefined;
		if (errors) {
			props.formItemErrors = errors;
		}
		props.key = fieldsetData.id;
		props.onChange = _.bind(this._onChangeFieldset, this);
		props.formType = this.props.formType;
		return props;
	}

	_onChangeFieldset(fieldsetId, newFormItems) {
		const newFieldsets = _.map(this.props.fieldsets, (fieldset) => {
			if (fieldset.id === fieldsetId) {
				const newFieldset = _.clone(fieldset);
				newFieldset.formItems = newFormItems;
				return newFieldset;
			} else {
				return fieldset;
			}
		});

		return this.props.onChange(
			_.extend({}, this.props, { fieldsets: newFieldsets }),
		);
	}
}
GeneratedForm.initClass();

module.exports = {
	FormItem,
	GeneratedForm,
	GeneratedFieldset,
};

function __guard__(value, transform) {
	return typeof value !== "undefined" && value !== null
		? transform(value)
		: undefined;
}
