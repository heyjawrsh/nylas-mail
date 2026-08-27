import * as IsomorphicCore from "isomorphic-core";
const { AuthHelpers } = IsomorphicCore;
import DefaultSyncPolicy from "../default-sync-policy.js";
import LocalDatabaseConnector from "../../shared/local-database-connector.js";
import SyncProcessManager from "../../local-sync-worker/sync-process-manager.js";
import { preventCreationOfDuplicateAccounts } from "../../shared/dedupe-accounts.js";

async function upsertAccount(accountParams, credentials) {
	accountParams.syncPolicy = DefaultSyncPolicy;
	accountParams.lastSyncCompletions = [];
	const db = await LocalDatabaseConnector.forShared();

	// NOTE: See https://phab.nylas.com/D4425 for explanation of why this check
	// is necessary
	// TODO remove this check after it no longer affects users
	await preventCreationOfDuplicateAccounts(db, accountParams);

	const { account, token } = await db.Account.upsertWithCredentials(
		accountParams,
		credentials,
	);
	SyncProcessManager.addWorkerForAccount(account);
	return { account, token };
}

export default (server) => {
	server.route({
		method: "POST",
		path: "/auth",
		options: AuthHelpers.imapAuthRouteConfig(),
		handler: AuthHelpers.imapAuthHandler(upsertAccount),
	});
};
