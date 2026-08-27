import { DataTypes } from "sequelize";

module.exports = {
	JSONColumn(fieldName, options = {}) {
		return Object.assign({}, options, {
			type: options.columnType || DataTypes.JSON,
			get() {
				const value = this.getDataValue(fieldName);
				if (value != null)
					return typeof value === "string" ? JSON.parse(value) : value;
				return options.defaultValue
					? Object.assign({}, options.defaultValue)
					: {};
			},
			defaultValue: undefined,
		});
	},

	JSONArrayColumn(fieldName, options = {}) {
		return Object.assign({}, options, {
			type: DataTypes.JSON,
			get() {
				const rawValue = this.getDataValue(fieldName);
				if (rawValue == null) return options.defaultValue || [];
				const value =
					typeof rawValue === "string" ? JSON.parse(rawValue) : rawValue;
				if (!Array.isArray(value))
					throw new Error("JSONArrayType should be an array");
				return value;
			},
			set(value) {
				if (!Array.isArray(value))
					throw new Error("JSONArrayType should be an array");
				this.setDataValue(fieldName, value);
			},
			defaultValue: undefined,
		});
	},
};
