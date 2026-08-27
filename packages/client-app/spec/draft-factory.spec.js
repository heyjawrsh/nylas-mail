import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	accountForId: vi.fn(),
	accounts: vi.fn(),
	fetchFile: vi.fn(),
	findAll: vi.fn(),
	inTransaction: vi.fn(),
	messageItems: vi.fn(() => []),
	messageThreadId: vi.fn(),
	prepareBodyForQuoting: vi.fn(),
	getDownloadDataForFile: vi.fn(),
	currentPerspective: vi.fn(),
}));

vi.mock("nylas-exports", () => ({
	FileDownloadStore: { getDownloadDataForFile: mocks.getDownloadDataForFile },
}));
vi.mock("../src/flux/actions.js", () => ({
	default: { fetchFile: mocks.fetchFile },
}));
vi.mock("../src/flux/stores/database-store.js", () => ({
	default: { findAll: mocks.findAll, inTransaction: mocks.inTransaction },
}));
vi.mock("../src/flux/stores/account-store.js", () => ({
	default: { accountForId: mocks.accountForId, accounts: mocks.accounts },
}));
vi.mock("../src/flux/stores/task-queue-status-store.js", () => ({
	waitForPerformLocal: vi.fn(),
}));
vi.mock("../src/flux/stores/contact-store.js", () => ({
	default: { parseContactsInString: vi.fn() },
}));
vi.mock("../src/flux/stores/message-store.js", () => ({
	default: { threadId: mocks.messageThreadId, items: mocks.messageItems },
}));
vi.mock("../src/flux/stores/focused-perspective-store.js", () => ({
	default: { current: mocks.currentPerspective },
}));
vi.mock("../src/flux/stores/draft-helpers.js", () => ({
	default: { prepareBodyForQuoting: mocks.prepareBodyForQuoting },
}));
vi.mock("../src/flux/models/thread.js", () => ({ default: class Thread {} }));
vi.mock("../src/flux/models/contact.js", () => ({ default: class Contact {} }));
vi.mock("../src/flux/models/message.js", () => ({
	default: class Message {
		constructor(fields) {
			Object.assign(this, fields);
		}
	},
}));

import DraftFactory from "../src/flux/stores/draft-factory.js";

const contact = (email, name = "") => ({
	email,
	name,
	toString: () => (name ? `${name} <${email}>` : email),
});
const me = contact("me@example.com", "Me");
const account = (fields = {}) => ({
	id: "account-1",
	aliases: [],
	defaultMe: () => me,
	meUsingAlias: vi.fn(),
	...fields,
});
const message = (fields = {}) => ({
	id: "message-1",
	threadId: "thread-1",
	accountId: "account-1",
	subject: "Quarterly Plan",
	body: "<p>Original body</p>",
	from: [contact("sender@example.com", "Sender")],
	to: [me],
	cc: [],
	files: [],
	formattedDate: () => "Aug 27 2026, at 2:30 pm",
	participantsForReply: () => ({ to: [contact("sender@example.com")], cc: [] }),
	participantsForReplyAll: () => ({
		to: [contact("sender@example.com")],
		cc: [contact("team@example.com")],
	}),
	...fields,
});

describe("DraftFactory", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.accountForId.mockReturnValue(account());
		mocks.accounts.mockReturnValue([account()]);
		mocks.currentPerspective.mockReturnValue({ accountIds: ["account-1"] });
		mocks.messageThreadId.mockReturnValue(undefined);
		NylasEnv.config.get.mockReturnValue("account-1");
	});

	it("creates a pristine draft for the configured account", async () => {
		const draft = await DraftFactory.createDraft();
		expect(draft).toMatchObject({
			body: "",
			subject: "",
			from: [me],
			draft: true,
			pristine: true,
			accountId: "account-1",
		});
	});

	it("allows supplied fields to override new-draft defaults", async () => {
		const draft = await DraftFactory.createDraft({ subject: "Hello", body: "Hi" });
		expect(draft.subject).toBe("Hello");
		expect(draft.body).toBe("Hi");
	});

	it("creates a reply with a Re: subject and reply recipients", async () => {
		const sender = contact("sender@example.com");
		const source = message({
			participantsForReply: () => ({ to: [sender], cc: [] }),
		});
		const draft = await DraftFactory.createDraftForReply({
			message: source,
			thread: { id: "thread-1" },
			type: "reply",
		});
		expect(draft.subject).toBe("Re: Quarterly Plan");
		expect(draft.to).toEqual([sender]);
		expect(draft.cc).toEqual([]);
	});

	it("does not duplicate an existing reply prefix", async () => {
		const draft = await DraftFactory.createDraftForReply({
			message: message({ subject: "Re: Quarterly Plan" }),
			thread: { id: "thread-1" },
			type: "reply",
		});
		expect(draft.subject).toBe("Re: Quarterly Plan");
	});

	it("creates reply-all with its complete recipient lists", async () => {
		const sender = contact("sender@example.com");
		const teammate = contact("team@example.com");
		const draft = await DraftFactory.createDraftForReply({
			message: message({
				participantsForReplyAll: () => ({ to: [sender], cc: [teammate] }),
			}),
			thread: { id: "thread-1" },
			type: "reply-all",
		});
		expect(draft.to).toEqual([sender]);
		expect(draft.cc).toEqual([teammate]);
	});

	it("ties replies to the source message and thread", async () => {
		const draft = await DraftFactory.createDraftForReply({
			message: message(),
			thread: { id: "thread-9" },
			type: "reply",
		});
		expect(draft.threadId).toBe("thread-9");
		expect(draft.replyToMessageId).toBe("message-1");
		expect(draft.body).toBe("");
	});

	it("uses the account default identity for a reply", async () => {
		const draft = await DraftFactory.createDraftForReply({
			message: message(),
			thread: { id: "thread-1" },
			type: "reply",
		});
		expect(draft.from).toEqual([me]);
	});

	it("uses an exact recipient alias for a reply", async () => {
		const alias = contact("alias@example.com", "Projects");
		const aliasedAccount = account({
			aliases: ["Projects <alias@example.com>"],
			meUsingAlias: () => alias,
		});
		mocks.accountForId.mockReturnValue(aliasedAccount);
		const draft = await DraftFactory.createDraftForReply({
			message: message({ to: [alias] }),
			thread: { id: "thread-1" },
			type: "reply",
		});
		expect(draft.from).toEqual([alias]);
	});

	it("creates a forward with a normalized Fwd: subject", async () => {
		mocks.prepareBodyForQuoting.mockResolvedValue("<p>Quoted</p>");
		const draft = await DraftFactory.createDraftForForward({
			thread: { id: "thread-1" },
			message: message({ subject: "Re: Quarterly Plan" }),
		});
		expect(draft.subject).toBe("Fwd: Quarterly Plan");
	});

	it("assembles forwarding headers and quoted body", async () => {
		mocks.prepareBodyForQuoting.mockResolvedValue("<p>Safe body</p>");
		const draft = await DraftFactory.createDraftForForward({
			thread: { id: "thread-1" },
			message: message({ cc: [contact("copy@example.com", "Copy")] }),
		});
		expect(draft.body).toContain("---------- Forwarded message ---------");
		expect(draft.body).toContain("From: Sender &lt;sender@example.com&gt;");
		expect(draft.body).toContain("Subject: Quarterly Plan");
		expect(draft.body).toContain("To: Me &lt;me@example.com&gt;");
		expect(draft.body).toContain("Cc: Copy &lt;copy@example.com&gt;");
		expect(draft.body).toContain("<p>Safe body</p>");
	});

	it("starts fetching every forwarded attachment", async () => {
		const files = [{ id: "file-1" }, { id: "file-2" }];
		mocks.prepareBodyForQuoting.mockResolvedValue("body");
		mocks.getDownloadDataForFile.mockReturnValue({
			fileId: "download",
			filename: "notes.txt",
			filesize: 12,
			targetPath: "/tmp/notes.txt",
		});
		await DraftFactory.createDraftForForward({
			thread: { id: "thread-1" },
			message: message({ files }),
		});
		expect(mocks.fetchFile).toHaveBeenCalledTimes(2);
		expect(mocks.fetchFile).toHaveBeenNthCalledWith(1, files[0]);
	});

	it("maps forwarded files into composer uploads", async () => {
		mocks.prepareBodyForQuoting.mockResolvedValue("body");
		mocks.getDownloadDataForFile.mockReturnValue({
			fileId: "download-1",
			filename: "notes.txt",
			filesize: 12,
			targetPath: "/tmp/mail/notes.txt",
		});
		const draft = await DraftFactory.createDraftForForward({
			thread: { id: "thread-1" },
			message: message({ files: [{ id: "file-1" }] }),
		});
		expect(draft.uploads).toEqual([
			expect.objectContaining({
				messageClientId: draft.clientId,
				id: "download-1",
				filename: "notes.txt",
				size: 12,
				targetDir: "/tmp/mail",
			}),
		]);
	});

	it("returns no update candidate for an unsupported preference", async () => {
		await expect(
			DraftFactory.candidateDraftForUpdating(message(), "always-new"),
		).resolves.toBeNull();
		expect(mocks.findAll).not.toHaveBeenCalled();
	});

	it("selects the newest matching draft when existing drafts are preferred", async () => {
		const first = { id: "draft-1", draft: true, replyToMessageId: "message-1" };
		const second = { id: "draft-2", draft: true, replyToMessageId: "message-1" };
		mocks.findAll.mockResolvedValue([first, { id: "other" }, second]);
		await expect(
			DraftFactory.candidateDraftForUpdating(message(), "prefer-existing"),
		).resolves.toBe(second);
	});

	it("uses loaded MessageStore items when the thread is open", async () => {
		const draft = { id: "draft-1", draft: true, replyToMessageId: "message-1" };
		mocks.messageThreadId.mockReturnValue("thread-1");
		mocks.messageItems.mockReturnValue([draft]);
		// Actual behavior: findAll is constructed unconditionally and the
		// open-thread shortcut replaces its result; the draft still resolves
		// from MessageStore.items().
		await expect(
			DraftFactory.candidateDraftForUpdating(message(), "prefer-existing"),
		).resolves.toBe(draft);
	});

	it("rejects an invalid create-or-update reply type", () => {
		expect(() =>
			DraftFactory.createOrUpdateDraftForReply({
				message: message(),
				thread: { id: "thread-1" },
				type: "forward",
				behavior: "always-new",
			}),
		).toThrow(/not reply or reply-all/);
	});
});
