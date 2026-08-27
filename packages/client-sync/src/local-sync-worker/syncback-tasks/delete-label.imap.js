import { SyncbackIMAPTask } from "./syncback-task.js";

class DeleteLabelIMAP extends SyncbackIMAPTask {
	description() {
		return `DeleteLabel`;
	}

	affectsImapMessageUIDs() {
		return false;
	}

	async *_run(db, imap) {
		const { labelId } = this.syncbackRequestObject().props.labelId;
		const label = yield db.Label.findByPk(labelId);
		if (!label) {
			// Nothing to delete!
			return;
		}
		yield imap.delBox(label.name);

		// If IMAP succeeds, save updates to the db
		yield label.destroy();
	}
}
export default DeleteLabelIMAP;
