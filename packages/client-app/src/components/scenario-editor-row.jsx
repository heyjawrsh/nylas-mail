/*
 * decaffeinate suggestions:
 * DS002: Fix invalid constructor
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
import PropTypes from "prop-types";
import React from "react";
import _ from "underscore";
import Rx from "rx-lite";

const SOURCE_SELECT_NULL = "NULL";

class SourceSelect extends React.Component {
	static initClass() {
		SourceSelect.displayName = "SourceSelect";
		SourceSelect.propTypes = {
			value: PropTypes.string,
			onChange: PropTypes.func.isRequired,
			options: PropTypes.oneOfType([PropTypes.object, PropTypes.array])
				.isRequired,
		};
	}

	constructor(props) {
		super();
		this.componentDidMount = this.componentDidMount.bind(this);
		this.UNSAFE_componentWillReceiveProps =
			this.UNSAFE_componentWillReceiveProps.bind(this);
		this.componentWillUnmount = this.componentWillUnmount.bind(this);
		this._setupValuesSubscription = this._setupValuesSubscription.bind(this);
		this.render = this.render.bind(this);
		this._onChange = this._onChange.bind(this);
		this.props = props;
		this.state = { options: [] };
	}

	componentDidMount() {
		return this._setupValuesSubscription();
	}

	UNSAFE_componentWillReceiveProps(nextProps) {
		return this._setupValuesSubscription(nextProps);
	}

	componentWillUnmount() {
		if (this._subscription != null) {
			this._subscription.dispose();
		}
		return (this._subscription = null);
	}

	_setupValuesSubscription(props) {
		if (props == null) {
			({ props } = this);
		}
		if (this._subscription != null) {
			this._subscription.dispose();
		}
		this._subscription = null;
		if (props.options instanceof Rx.Observable) {
			return (this._subscription = props.options.subscribe((options) => {
				return this.setState({ options });
			}));
		} else {
			return this.setState({ options: props.options });
		}
	}

	render() {
		const { options } = this.state;

		// The React <select> component won't select the correct option if the value
		// is null or undefined - it just leaves the selection whatever it was in the
		// previous render. To work around this, we coerce null/undefined to SOURCE_SELECT_NULL.

		return React.createElement(
			"select",
			{
				value: this.props.value || SOURCE_SELECT_NULL,
				onChange: this._onChange,
			},
			React.createElement("option", {
				key: SOURCE_SELECT_NULL,
				value: SOURCE_SELECT_NULL,
			}),
			this.state.options.map(({ value, name }) => {
				return React.createElement(
					"option",
					{ key: value, value: value },
					name,
				);
			}),
		);
	}

	_onChange(event) {
		let { value } = event.target;
		if (value === SOURCE_SELECT_NULL) {
			value = null;
		}
		return this.props.onChange({ target: { value } });
	}
}
SourceSelect.initClass();

class ScenarioEditorRow extends React.Component {
	static initClass() {
		ScenarioEditorRow.displayName = "ScenarioEditorRow";
		ScenarioEditorRow.propTypes = {
			instance: PropTypes.object.isRequired,
			removable: PropTypes.bool,
			templates: PropTypes.array.isRequired,
			onChange: PropTypes.func,
			onInsert: PropTypes.func,
			onRemove: PropTypes.func,
		};
	}

	constructor(props) {
		super(props);
		this.render = this.render.bind(this);
		this._renderTemplateSelect = this._renderTemplateSelect.bind(this);
		this._renderComparator = this._renderComparator.bind(this);
		this._renderValue = this._renderValue.bind(this);
		this._renderActions = this._renderActions.bind(this);
		this._onChangeValue = this._onChangeValue.bind(this);
		this._onChangeComparator = this._onChangeComparator.bind(this);
		this._onChangeTemplate = this._onChangeTemplate.bind(this);
		this.props = props;
	}

	render() {
		const template = _.findWhere(this.props.templates, {
			key: this.props.instance.templateKey,
		});
		if (!template) {
			return React.createElement(
				"span",
				null,
				" Could not find template for instance key: ",
				this.props.instance.templateKey,
			);
		}

		return React.createElement(
			Flexbox,
			{ direction: "row", className: "well-row" },
			React.createElement(
				"span",
				null,
				this._renderTemplateSelect(template),
				this._renderComparator(template),
				React.createElement("span", null, template.valueLabel),
				this._renderValue(template),
			),
			React.createElement("div", { style: { flex: 1 } }),
			this._renderActions(),
		);
	}

	_renderTemplateSelect(_template) {
		const options = this.props.templates.map(({ key, name }) => {
			return React.createElement("option", { value: key, key: key }, name);
		});

		return React.createElement(
			"select",
			{
				value: this.props.instance.templateKey,
				onChange: this._onChangeTemplate,
			},
			options,
		);
	}

	_renderComparator(template) {
		const options = _.map(template.comparators, ({ name }, key) => {
			return React.createElement("option", { key: key, value: key }, name);
		});

		if (!(options.length > 0)) {
			return false;
		}

		return React.createElement(
			"select",
			{
				value: this.props.instance.comparatorKey,
				onChange: this._onChangeComparator,
			},
			options,
		);
	}

	_renderValue(template) {
		if (template.type === Template.Type.Enum) {
			return React.createElement(SourceSelect, {
				value: this.props.instance.value,
				onChange: this._onChangeValue,
				options: template.values,
			});
		} else if (template.type === Template.Type.String) {
			return React.createElement("input", {
				type: "text",
				value: this.props.instance.value,
				onChange: this._onChangeValue,
			});
		} else {
			return false;
		}
	}

	_renderActions() {
		return React.createElement(
			"div",
			{ className: "actions" },
			this.props.removable
				? React.createElement(
						"div",
						{ className: "btn", onClick: this.props.onRemove },
						"−",
					)
				: undefined,
			React.createElement(
				"div",
				{ className: "btn", onClick: this.props.onInsert },
				"+",
			),
		);
	}

	_onChangeValue(event) {
		const instance = _.clone(this.props.instance);
		instance.value = event.target.value;
		return this.props.onChange(instance);
	}

	_onChangeComparator(event) {
		const instance = _.clone(this.props.instance);
		instance.comparatorKey = event.target.value;
		return this.props.onChange(instance);
	}

	_onChangeTemplate(event) {
		let instance = _.clone(this.props.instance);

		const _existingTemplate = _.findWhere(this.props.templates, {
			key: instance.key,
		});
		const newTemplate = _.findWhere(this.props.templates, {
			key: event.target.value,
		});

		instance = newTemplate.coerceInstance(instance);

		return this.props.onChange(instance);
	}
}
ScenarioEditorRow.initClass();

module.exports = ScenarioEditorRow;
