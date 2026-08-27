import { JSONArrayColumn } from "../database-types";
import { MAX_INDEXABLE_LENGTH } from "../db-utils";

module.exports = (sequelize, Sequelize) => {
	const Transaction = sequelize.define(
		"transaction",
		{
			event: Sequelize.STRING(MAX_INDEXABLE_LENGTH),
			object: Sequelize.STRING(MAX_INDEXABLE_LENGTH),
			objectId: Sequelize.STRING(MAX_INDEXABLE_LENGTH),
			accountId: Sequelize.STRING(MAX_INDEXABLE_LENGTH),
			changedFields: JSONArrayColumn("changedFields"),
		},
		{
			indexes: [{ fields: ["accountId"] }],
		},
	);
	Transaction.prototype.toJSON = function toJSON() {
		return {
			id: `${this.id}`,
			event: this.event,
			object: this.object,
			objectId: `${this.objectId}`,
		};
	};
	return Transaction;
};
