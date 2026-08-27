/*
 * decaffeinate suggestions:
 * DS002: Fix invalid constructor
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
const React = require("react");
const _ = require("underscore");
const { Comparator, Template } = require("./scenario-editor-models");
const ScenarioEditorRow = require("./scenario-editor-row");
const { RetinaImg, Flexbox } = require("nylas-component-kit");
const { Actions, Utils } = require("nylas-exports");

/*
The ScenarioEditor takes an array of ScenarioTemplate objects which define the
scenario value space. Each ScenarioTemplate defines a `key` and it's valid
`comparators` and `values`. The ScenarioEditor gives the user the option to
create and combine instances of different templates to create a scenario.

For example:

  Scenario Space:
   - ScenarioFactory("user-name", "The name of the user")
      + valueType: String
      + comparators: "contains", "starts with", etc.
    - SecnarioFactor("profession", "The profession of the user")
      + valueType: Enum
      + comparators: 'is'

  Scenario Value:
    [{
      'key': 'user-name'
      'comparator': 'contains'
      'value': 'Ben'
    },{
      'key': 'profession'
      'comparator': 'is'
      'value': 'Engineer'
    }]
*/

class ScenarioEditor extends React.Component {
	static initClass() {
		ScenarioEditor.displayName = "ScenarioEditor";

		ScenarioEditor.propTypes = {
			instances: PropTypes.array,
			className: PropTypes.string,
			onChange: PropTypes.func,
			templates: PropTypes.array,
		};

		ScenarioEditor.Template = Template;
		ScenarioEditor.Comparator = Comparator;
	}

	constructor(props) {
		this.render = this.render.bind(this);
		this._performChange = this._performChange.bind(this);
		this._onRemoveRule = this._onRemoveRule.bind(this);
		this._onInsertRule = this._onInsertRule.bind(this);
		this._onChangeRowValue = this._onChangeRowValue.bind(this);
		this.props = props;
		this.state = { collapsed: true };
	}

	render() {
		return React.createElement(
			"div",
			{ className: this.props.className },
			(this.props.instances || []).map((instance, idx) => {
				return React.createElement(ScenarioEditorRow, {
					key: idx,
					instance: instance,
					removable: this.props.instances.length > 1,
					templates: this.props.templates,
					onRemove: () => this._onRemoveRule(idx),
					onInsert: () => this._onInsertRule(idx),
					onChange: (instance) => this._onChangeRowValue(instance, idx),
				});
			}),
		);
	}

	_performChange(block) {
		const instances = JSON.parse(JSON.stringify(this.props.instances));
		block(instances);
		return this.props.onChange(instances);
	}

	_onRemoveRule(idx) {
		return this._performChange((instances) => {
			if (instances.length === 1) {
				return;
			}
			return instances.splice(idx, 1);
		});
	}

	_onInsertRule(idx) {
		return this._performChange((instances) => {
			return instances.push(this.props.templates[0].createDefaultInstance());
		});
	}

	_onChangeRowValue(newInstance, idx) {
		return this._performChange((instances) => {
			return (instances[idx] = newInstance);
		});
	}
}
ScenarioEditor.initClass();

module.exports = ScenarioEditor;
