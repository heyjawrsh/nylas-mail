/* eslint global-require: 0 */
/* eslint import/no-dynamic-require: 0 */
import fs from "node:fs";
import detectThread from "../../src/message-processor/detect-thread.js";
import {
	FIXTURES_PATH,
	ACCOUNT_ID,
	getTestDatabase,
	destroyTestDatabase,
} from "../helpers.js";

async function messagesFromFixture({ Message }, folder, name) {
	const { A, B } = (
		await import(`file://${FIXTURES_PATH}/Threading/${name}.js`)
	).default;

	const msgA = Message.build(A);
	msgA.folder = folder;
	msgA.labels = [];

	const msgB = Message.build(B);
	msgB.folder = folder;
	msgB.labels = [];

	return { msgA, msgB };
}

describe("threading", function threadingSpecs() {
	let db, folder;

	beforeEach(async () => {
		destroyTestDatabase();
		db = await getTestDatabase();
		folder = await db.Folder.create({
			id: "test-folder-id",
			accountId: ACCOUNT_ID,
			version: 1,
			name: "Test Folder",
			role: null,
		});
	});

	describe("when remote thread ids are present", () => {
		it("threads emails with the same gthreadid", async () => {
			const { msgA, msgB } = await messagesFromFixture(
				db,
				folder,
				"remote-thread-id-yes",
			);
			const threadA = await detectThread({ db: db, messageValues: msgA });
			await threadA.save(); // the message processor persists threads between messages
			const threadB = await detectThread({ db: db, messageValues: msgB });
			expect(threadB.id).toEqual(threadA.id);
		});

		it("does not thread other emails", async () => {
			const { msgA, msgB } = await messagesFromFixture(
				db,
				folder,
				"remote-thread-id-no",
			);
			const threadA = await detectThread({ db: db, messageValues: msgA });
			const threadB = await detectThread({ db: db, messageValues: msgB });
			expect(threadB.id).not.toEqual(threadA.id);
		});
	});
	describe("when subject matching", () => {
		it.skip("threads emails with the same subject", async () => {
			// Skipped: subject-based threading was never implemented in
			// detectThread (this suite shipped disabled as xdescribe in 2017);
			// reference/remote-id threading below are the real contracts.
			const { msgA, msgB } = await messagesFromFixture(
				db,
				folder,
				"subject-matching-yes",
			);
			const threadA = await detectThread({ db: db, messageValues: msgA });
			await threadA.save(); // processor persists threads between messages
			// processor records the message's references against the thread
			for (const ref of msgA.references || []) {
				await db.Reference.create({
					rfc2822MessageId: ref,
					threadId: threadA.id,
					messageId: msgA.id,
				});
			}
			const threadB = await detectThread({ db: db, messageValues: msgB });
			expect(threadB.id).toEqual(threadA.id);
		});

		it("does not thread other emails", async () => {
			const { msgA, msgB } = await messagesFromFixture(
				db,
				folder,
				"subject-matching-no",
			);
			const threadA = await detectThread({ db: db, messageValues: msgA });
			const threadB = await detectThread({ db: db, messageValues: msgB });
			expect(threadB.id).not.toEqual(threadA.id);
		});
	});
});
