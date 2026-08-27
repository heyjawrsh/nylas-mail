import React from "react";
import PropTypes from "prop-types";
const FormField = (props) => {
	return (
		<span>
			<label htmlFor={props.field}>{props.title}:</label>
			<input
				type={props.type || "text"}
				id={props.field}
				style={props.style}
				className={
					props.accountInfo[props.field] &&
					props.errorFieldNames.includes(props.field)
						? "error"
						: ""
				}
				disabled={props.submitting}
				value={props.accountInfo[props.field] || ""}
				onKeyPress={props.onFieldKeyPress}
				onChange={props.onFieldChange}
			/>
		</span>
	);
};

FormField.propTypes = {
	field: PropTypes.string,
	title: PropTypes.string,
	type: PropTypes.string,
	style: PropTypes.object,
	submitting: PropTypes.bool,
	onFieldKeyPress: PropTypes.func,
	onFieldChange: PropTypes.func,
	errorFieldNames: PropTypes.array,
	accountInfo: PropTypes.object,
};

export default FormField;
