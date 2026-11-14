import Task from "./task.js";
import { APIError } from "../errors.js";
import Message from "../models/message.js";
import DatabaseStore from "../stores/database-store.js";
import NylasAPI from "../nylas-api.js";
import NylasAPIRequest from "../nylas-api-request.js";
import BaseDraftTask from "./base-draft-task.js";

export default class DestroyDraftTask extends BaseDraftTask {
	shouldDequeueOtherTask(other) {
		return (
			other instanceof BaseDraftTask &&
			other.draftClientId === this.draftClientId
		);
	}

	performLocal() {
		super.performLocal();
		return this.refreshDraftReference()
			.then(() =>
				DatabaseStore.inTransaction((t) => t.unpersistModel(this.draft)),
			)
			.catch((err) => {
				// A pristine draft may never have been saved; it's already gone.
				if (!(err instanceof BaseDraftTask.DraftNotFoundError)) throw err;
			});
	}

	performRemote() {
		// We don't need to do anything if we weren't able to find the draft
		// when we performed locally, or if the draft has never been synced to
		// the server (id is still self-assigned)
		if (!this.draft) {
			return Promise.resolve(Task.Status.Continue);
		}
		if (!this.draft.serverId) {
			return Promise.resolve(Task.Status.Continue);
		}
		if (!this.draft.version) {
			const err = new Error(
				"Can't destroy draft without a version or serverId",
			);
			return Promise.resolve([Task.Status.Failed, err]);
		}

		NylasAPI.incrementRemoteChangeLock(Message, this.draft.serverId);

		return (
			new NylasAPIRequest({
				api: NylasAPI,
				options: {
					path: `/drafts/${this.draft.serverId}`,
					accountId: this.draft.accountId,
					method: "DELETE",
					body: {
						version: this.draft.version,
					},
				},
			})
				.run()
				// We deliberately do not decrement the change count, ensuring no deltas
				// about this object are received that could restore it.
				.then(() => Task.Status.Success)
				.catch((err) => {
					if (!(err instanceof APIError)) throw err;
					NylasAPI.decrementRemoteChangeLock(Message, this.draft.serverId);

					const inboxMsg = err.body?.message ? err.body.message : "";

					// Draft has already been deleted, this is not really an error
					if ([404, 409].includes(err.statusCode)) {
						return Promise.resolve(Task.Status.Continue);
					}
					// Draft has been sent, and can't be deleted. Not much we can do but finish
					if (inboxMsg.indexOf("is not a draft") >= 0) {
						return Promise.resolve(Task.Status.Continue);
					}
					if (!NylasAPI.PermanentErrorCodes.includes(err.statusCode)) {
						return Promise.resolve(Task.Status.Retry);
					}

					NylasEnv.showErrorDialog("Unable to delete this draft. Restoring...");

					return DatabaseStore.inTransaction((t) =>
						t.persistModel(this.draft),
					).then(() => Promise.resolve(Task.Status.Failed));
				})
		);
	}
}
