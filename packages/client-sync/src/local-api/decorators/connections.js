/* eslint func-names:0 */

import LocalDatabaseConnector from "../../shared/local-database-connector.js";

export default (server) => {
	server.decorate("request", "getAccountDatabase", function () {
		const account = this.auth.credentials;
		return LocalDatabaseConnector.forAccount(account.id);
	});
	server.decorate(
		"request",
		"logger",
		() => {
			return global.Logger;
		},
		{ apply: true },
	);
};
