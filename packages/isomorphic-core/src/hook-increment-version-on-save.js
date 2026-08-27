import _ from "underscore";

export default (db) => {
	for (const modelName of Object.keys(db)) {
		const model = db[modelName];

		const allIgnoredFields = (changedFields) => {
			return _.isEqual(changedFields, ["syncState"]);
		};

		model.beforeCreate("increment-version-c", (instance) => {
			instance.version = 1;
		});
		model.beforeUpdate("increment-version-u", (instance) => {
			if (!allIgnoredFields(instance.changed() || [])) {
				instance.version = instance.version ? instance.version + 1 : 1;
			}
		});
	}
};
