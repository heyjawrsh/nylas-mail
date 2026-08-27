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
const _ = require('underscore');
const classNames = require('classnames');
const React = require('react');
const ReactDOM = require('react-dom');
const {Utils} = require('nylas-exports');
const DatePicker = require('./date-picker').default;
const TabGroupRegion = require('./tab-group-region');

const idPropType = React.PropTypes.oneOfType([
  React.PropTypes.string,
  React.PropTypes.number
]);

// The FormItem acts like a React controlled input.
// The `value` will set the "value" of whatever type of form item it is.
// The `onChange` handler will get passed this item's unique index (so
// parents can lookup and change the data appropriately) and the new value.
// Either direct parents, grandparents, etc are responsible for updating
// the `value` prop to update the value again.
class FormItem extends React.Component {
  constructor(...args) {
    this.render = this.render.bind(this);
    this.shouldComponentUpdate = this.shouldComponentUpdate.bind(this);
    this._renderError = this._renderError.bind(this);
    this._isDisabled = this._isDisabled.bind(this);
    this._renderInput = this._renderInput.bind(this);
    super(...args);
  }

  static initClass() {
    this.displayName = "FormItem";
  
    this.inputElementTypes = {
      "checkbox": true,
      "color": true,
      "date": false, // We use Nylas DatePicker instead
      "datetime": true,
      "datetime-local": true,
      "email": true,
      "file": true,
      "hidden": true,
      "month": true,
      "number": true,
      "password": true,
      "radio": true,
      "range": true,
      "search": true,
      "tel": true,
      "text": true,
      "time": true,
      "url": true,
      "week": true
    };
  
    this.propTypes = {
      // Some sort of unique identifier
      id: idPropType.isRequired,
  
      // Either a type of input or any type that can be passed into
      // `React.createElement(type, ...)`
      type: React.PropTypes.string.isRequired,
  
      // The name as POSTed to the eventual endpoint.
      name: React.PropTypes.string,
  
      // The human-readable display label for the formItem
      label: React.PropTypes.node,
  
      // Most input types take strings, numbers, and bools. Some types (like
      // "reference" can get passed arrays)
      value: React.PropTypes.oneOfType([
        React.PropTypes.string,
        React.PropTypes.number,
        React.PropTypes.bool
      ]),
      defaultValue: React.PropTypes.string,
  
      // A function that takes two arguments:
      //   - The id of this FormItem
      //   - The new value of the FormItem
      onChange: React.PropTypes.func,
  
      // FormItems can either explicitly set the disabled state, or determine
      // the disabled state by whether or not this is a 'new' or 'update'
      // form.
      formType: React.PropTypes.oneOf(['new', 'update']),
      disabled: React.PropTypes.bool,
      editableForNew: React.PropTypes.bool,
      editableForUpdate: React.PropTypes.bool,
  
      formItemError: React.PropTypes.shape({
        id: idPropType, // The formItemId
        message: React.PropTypes.string
      }),
  
      // selectOptions
      // An array of options.
      selectOptions: React.PropTypes.arrayOf(React.PropTypes.shape({
        label: React.PropTypes.node,
        value: React.PropTypes.string
      })),
  
      // Common <input> props.
      // Anything that can be passed into a standard React <input> item will
      // be passed along. Here are some common ones. There can be many more
      multiple: React.PropTypes.bool,
      required: React.PropTypes.bool,
      prefilled: React.PropTypes.bool,
      maxlength: React.PropTypes.number,
      placeholder: React.PropTypes.node,
      tabIndex: React.PropTypes.oneOfType([
        React.PropTypes.number,
        React.PropTypes.string,
      ]),
  
      //### Used by "reference" type objects
      customComponent: React.PropTypes.func,
      contextData: React.PropTypes.object,
      referenceTo: React.PropTypes.oneOfType([
        React.PropTypes.array,
        React.PropTypes.string,
      ]),
      referenceType: React.PropTypes.oneOf(["belongsTo", "hasMany", "hasManyThrough"]),
      referenceThrough: React.PropTypes.string,
  
      currentFormValues: React.PropTypes.object
    };
  }

  render() {
    const classes = classNames({
      "prefilled": this.props.prefilled,
      "form-item": true,
      "invalid": !this._isValid(),
      "valid": this._isValid()
    });

    let {
      label
    } = this.props;
    if (this.props.required) {
      label = React.createElement("strong", null, React.createElement("span", {"className": "required"}, "*"), (this.props.label));
    }

    if (this.props.type === "hidden") {
      return this._renderInput();
    } else {
      return React.createElement("div", {"className": (classes), "ref": "inputWrap"},
        React.createElement("div", {"className": "label-area"},
          React.createElement("label", {"htmlFor": (this.props.id)}, (label))
        ),
        React.createElement("div", {"className": "input-area"},
          (this._renderInput()),
          (this._renderError())
        )
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
    if (this._isValid()) { return false; }
    const msg = this.props.formItemError.message;
    return React.createElement("div", {"className": "form-error"}, (msg));
  }

  _isDisabled() {
    return this.props.disabled ||
    ((this.props.formType === "new") && (this.props.editableForNew === false)) ||
    ((this.props.formType === "update") && (this.props.editableForUpdate === false));
  }

  _renderInput() {
    const inputProps = _.extend({}, this.props, {
      ref: "input",
      onChange: eventOrValue => {
        return this.props.onChange(this.props.id, ((__guard__(eventOrValue != null ? eventOrValue.target : undefined, x => x.value)) != null ? __guard__(eventOrValue != null ? eventOrValue.target : undefined, x => x.value) : eventOrValue));
      }
    }
    );

    if (this._isDisabled()) { inputProps.disabled = true; }

    if (FormItem.inputElementTypes[this.props.type]) {
      return React.createElement("input", inputProps);
    } else if (this.props.type === "select") {
      const options = (this.props.selectOptions != null ? this.props.selectOptions : []).map(optionData => React.createElement("option", Object.assign({},  optionData, {"key": (`${Utils.generateTempId()}-optionData.value`)}), (optionData.label)));
      options.unshift(React.createElement("option", {"key": (`${Utils.generateTempId()}-blank-option`)}));
      return React.createElement("select", Object.assign({},  inputProps), (options));
    } else if (this.props.type === "textarea") {
      return React.createElement("textarea", inputProps);
    } else if (this.props.type === "date") {
      inputProps.dateFormat = "YYYY-MM-DD";
      return React.createElement(DatePicker, inputProps);
    } else if (this.props.type === "EmptySpace") {
      return React.createElement("div", {className: "empty-space"});
    } else if (_.isFunction(this.props.customComponent)) {
      return React.createElement(this.props.customComponent, inputProps);
    } else {
      return console.warn(`We do not support type ${this.props.type} with attributes:`, inputProps);
    }
  }
}
FormItem.initClass();

class GeneratedFieldset extends React.Component {
  constructor(...args) {
    this.render = this.render.bind(this);
    this.shouldComponentUpdate = this.shouldComponentUpdate.bind(this);
    this._renderHeader = this._renderHeader.bind(this);
    this._renderFormItems = this._renderFormItems.bind(this);
    this._propsFromFormItemData = this._propsFromFormItemData.bind(this);
    this._onChangeItem = this._onChangeItem.bind(this);
    this._renderFooter = this._renderFooter.bind(this);
    super(...args);
  }

  static initClass() {
    this.displayName = "GeneratedFieldset";
  
    this.propTypes = {
      // Some sort of unique identifier
      id: idPropType.isRequired,
  
      formItems: React.PropTypes.arrayOf(React.PropTypes.shape(
        _.extend(FormItem.propTypes, {
          row: React.PropTypes.number,
          column: React.PropTypes.number
        }
        )
      )),
  
      // The key is the formItem id, the value is the error object
      formItemErrors: React.PropTypes.arrayOf(FormItem.propTypes.formItemError),
  
      // A function that takes two arguments:
      //   - The id of this GeneratedFieldset
      //   - A new array of updated formItems with the correct value.
      onChange: React.PropTypes.func,
  
      heading: React.PropTypes.node,
      useHeading: React.PropTypes.bool,
      formType: React.PropTypes.oneOf(['new', 'update']),
      zIndex: React.PropTypes.number,
  
      lastFieldset: React.PropTypes.bool,
      firstFieldset: React.PropTypes.bool,
      contextData: React.PropTypes.object,
  
      currentFormValues: React.PropTypes.object
    };
  }

  render() {
    const classStr = classNames({
      "first-fieldset": this.props.firstFieldset,
      "last-fieldset": this.props.lastFieldset
    });

    return React.createElement("fieldset", {"style": ({zIndex: this.props.zIndex != null ? this.props.zIndex : 0}), "className": (classStr)},
      (this._renderHeader()),
      React.createElement("div", {"className": "fieldset-form-items"},
        (this._renderFormItems())
      ),
      (this._renderFooter())
    );
  }

  shouldComponentUpdate(nextProps) {
    return !Utils.isEqualReact(nextProps, this.props);
  }

  _renderHeader() {
    if (this.props.useHeading) {
      return React.createElement("header", null, React.createElement("legend", null, (this.props.heading)));
    } else { return React.createElement("div", null); }
  }

  _renderFormItems() {
    const byRow = _.groupBy(this.props.formItems, "row");
    return _.map(byRow, (itemsInRow, rowNum) => {
      if (itemsInRow == null) { itemsInRow = []; }
      const byCol = _.groupBy(itemsInRow, "column");
      const numCols = Math.max.apply(null, Object.keys(byCol));

      const style = { zIndex: 1000-rowNum };
      const allHidden = _.every(itemsInRow, item => item.type === "hidden");
      if (allHidden) { style.display = "none"; }

      return React.createElement("div", {"className": "row",  
           "data-row-num": (rowNum),  
           "style": (style),  
           "key": (rowNum)},
        (_.map(byCol, (itemsInCol, colNum) => {
          if (itemsInCol == null) { itemsInCol = []; }
          const colEls = [React.createElement("div", {"className": "column", "data-col-num": (colNum), "key": (colNum)},
            (itemsInCol.map(formItemData => {
              const props = this._propsFromFormItemData(formItemData);
              return React.createElement(FormItem, Object.assign({},  props, {"ref": (`form-item-${formItemData.id}`)}));
            }))
          )];
          if (colNum !== (numCols - 1)) {
            colEls.push(
              React.createElement("div", {"className": "column-spacer", "data-col-num": (`${colNum}-spacer`), "key": (`${colNum}-spacer`)}
              )
            );
          }
          return colEls;
        }))
      );
    });
  }

  // Given the raw data of an individual FormItem, prepare a set of props
  // to pass down into the FormItem.
  _propsFromFormItemData(formItemData) {
    const props = _.clone(formItemData);
    props.key = props.id;
    const error = this.props.formItemErrors != null ? this.props.formItemErrors[props.id] : undefined;
    if (error) { props.formItemError = error; }
    props.onChange = _.bind(this._onChangeItem, this);
    props.formType = this.props.formType;
    props.contextData = this.props.contextData;
    props.currentFormValues = this.props.currentFormValues;
    return props;
  }

  _onChangeItem(itemId, newValue) {
    const newFormItems = _.map(this.props.formItems, function(formItem) {
      if (formItem.id === itemId) {
        const newFormItem = _.clone(formItem);
        newFormItem.value = newValue;
        return newFormItem;
      } else { return formItem; }
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
    this.render = this.render.bind(this);
    this.shouldComponentUpdate = this.shouldComponentUpdate.bind(this);
    this._onKeyDown = this._onKeyDown.bind(this);
    this._renderPrefilledMessage = this._renderPrefilledMessage.bind(this);
    this._renderHeaderFormError = this._renderHeaderFormError.bind(this);
    this._renderFieldsets = this._renderFieldsets.bind(this);
    this._currentFormValues = this._currentFormValues.bind(this);
    this._propsFromFieldsetData = this._propsFromFieldsetData.bind(this);
    this._onChangeFieldset = this._onChangeFieldset.bind(this);
    super(...args);
  }

  static initClass() {
    this.displayName = "GeneratedForm";
  
    this.propTypes = {
      // Some sort of unique identifier
      id: idPropType,
  
      errors: React.PropTypes.shape({
        formError: React.PropTypes.shape({
          message: React.PropTypes.string,
          location: React.PropTypes.string // Can be "header" (default) or "footer"
        }),
        formItemErrors: GeneratedFieldset.propTypes.formItemErrors
      }),
  
      fieldsets: React.PropTypes.arrayOf(
        React.PropTypes.shape(GeneratedFieldset.propTypes)
      ),
  
      // A function whose argument is a new set of Props
      onChange: React.PropTypes.func.isRequired,
  
      onSubmit: React.PropTypes.func.isRequired,
  
      style: React.PropTypes.object,
  
      formType: React.PropTypes.oneOf(['new', 'update']),
      prefilled: React.PropTypes.bool,
      contextData: React.PropTypes.object,
    };
  
    this.defaultProps = {
      style: {},
      onSubmit() {}
    };
  }

  render() {
    const submitText = this.props.formType === "new" ? "Create" : "Update";
    return React.createElement("form", {"className": "generated-form", "ref": "form", "style": (this.props.style), "onSubmit": (this.props.onSubmit), "onKeyDown": (this._onKeyDown), "noValidate": true},
      React.createElement(TabGroupRegion, null,
        (this._renderHeaderFormError()),
        (this._renderPrefilledMessage()),
        React.createElement("div", {"className": "fieldsets"},
          (this._renderFieldsets())
        ),
        React.createElement("div", {"className": "form-footer"},
          React.createElement("button", {"type": "button", "className": "btn btn-emphasis", "onClick": (this.props.onSubmit)},
            (submitText)
          )
        )
      )
    );
  }

  shouldComponentUpdate(nextProps) {
    return !Utils.isEqualReact(nextProps, this.props);
  }

  componentDidUpdate(prevProps) {
    if (!(prevProps.errors != null ? prevProps.errors.formError : undefined) && (this.props.errors != null ? this.props.errors.formError : undefined)) {
      return ReactDOM.findDOMNode(this.refs.formHeaderError).scrollIntoView(true);
    }
  }

  _onKeyDown(event) {
    if ((event.key === "Enter") && (event.metaKey || event.ctrlKey)) {
      return this.props.onSubmit(event);
    }
  }

  _renderPrefilledMessage() {
    if (this.props.prefilled) {
      return React.createElement("div", {"className": "prefilled-message"}, `\
The `, React.createElement("span", {"className": "highlighted"}, "highlighted"), ` fields have been prefilled for you!\
`);
    }
  }

  _renderHeaderFormError() {
    if (this.props.errors != null ? this.props.errors.formError : undefined) {
      return React.createElement("div", {"ref": "formHeaderError", "className": "form-error form-header-error"},
        (this.props.errors.formError.message)
      );
    } else { return false; }
  }

  _renderFieldsets() {
    return (this.props.fieldsets != null ? this.props.fieldsets : []).map((fieldset, i) => {
      const props = this._propsFromFieldsetData(fieldset);
      props.zIndex = 100-i;
      props.contextData = this.props.contextData;
      props.currentFormValues = this._currentFormValues();
      props.firstFieldset = i === 0;
      props.lastFieldset = (i !== 0) && (i === (this.props.fieldsets.length - 1));
      return React.createElement(GeneratedFieldset, Object.assign({},  props, {"ref": (`fieldset-${fieldset.id}`)}));
    });
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
    const errors = this.props.errors != null ? this.props.errors.formItemErrors : undefined;
    if (errors) { props.formItemErrors = errors; }
    props.key = fieldsetData.id;
    props.onChange = _.bind(this._onChangeFieldset, this);
    props.formType = this.props.formType;
    return props;
  }

  _onChangeFieldset(fieldsetId, newFormItems) {
    const newFieldsets = _.map(this.props.fieldsets, function(fieldset) {
      if (fieldset.id === fieldsetId) {
        const newFieldset = _.clone(fieldset);
        newFieldset.formItems = newFormItems;
        return newFieldset;
      } else { return fieldset; }
    });

    return this.props.onChange(_.extend({}, this.props,
      {fieldsets: newFieldsets})
    );
  }
}
GeneratedForm.initClass();

module.exports = {
  FormItem,
  GeneratedForm,
  GeneratedFieldset
};

function __guard__(value, transform) {
  return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
}