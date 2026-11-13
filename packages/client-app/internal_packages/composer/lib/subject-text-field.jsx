import { Component, createRef } from "react";
import PropTypes from "prop-types";

export default class SubjectTextField extends Component {
	static displayName = "SubjectTextField";

	static containerRequired = false;

	static propTypes = {
		value: PropTypes.string,
		onSubjectChange: PropTypes.func,
	};

	_input = createRef();

	onInputChange = ({ target: { value } }) => {
		this.props.onSubjectChange(value);
	};

	focus() {
		this._input.current.focus();
	}

	render() {
		const { value } = this.props;

		return (
			<div className="composer-subject subject-field">
				<input
					ref={this._input}
					type="text"
					name="subject"
					placeholder="Subject"
					value={value}
					onChange={this.onInputChange}
				/>
			</div>
		);
	}
}
