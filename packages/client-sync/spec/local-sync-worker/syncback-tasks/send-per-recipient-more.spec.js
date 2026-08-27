import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	buildForSend: vi.fn(),
	stripTrackingLinksFromBody: vi.fn((body) => `stripped:${body}`),
	addRecipientToTrackingLinks: vi.fn(({ recipient }) => `body:${recipient.email}`),
	copyModelValues: vi.fn((message, changes) => ({ ...message, ...changes })),
}));

vi.mock("isomorphic-core", () => ({
	Provider: { Gmail: "gmail" },
	Errors: {
		APIError: class APIError extends Error {},
		RetryableError: class RetryableError extends Error {},
	},
	MessageUtils: {
		buildForSend: mocks.buildForSend,
		getReplyHeaders: vi.fn(),
		buildMime: vi.fn(),
	},
	TrackingUtils: {
		stripTrackingLinksFromBody: mocks.stripTrackingLinksFromBody,
		addRecipientToTrackingLinks: mocks.addRecipientToTrackingLinks,
	},
	ModelUtils: { copyModelValues: mocks.copyModelValues },
}));

import SendMessagePerRecipientSMTP from "../../../src/local-sync-worker/syncback-tasks/send-message-per-recipient.smtp.js";

const account = { id: "account", provider: "imap" };

function message() {
	const recipients = [
		{ email: "one@example.com" },
		{ email: "two@example.com" },
		{ email: "three@example.com" },
	];
	return {
		id: "message",
		body: "original",
		references: ["ref"],
		inReplyTo: "reply",
		getRecipients: vi.fn(() => recipients),
		setIsSent: vi.fn(),
		save: vi.fn(),
		toJSON: vi.fn(() => ({ id: "message", body: "saved" })),
	};
}

describe("SendMessagePerRecipientSMTP", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		global.Logger = {
			forAccount: () => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn() }),
		};
	});

	it("individualizes and sends once to every recipient", async () => {
		const baseMessage = message();
		mocks.buildForSend.mockResolvedValue(baseMessage);
		const smtp = { sendCustom: vi.fn().mockResolvedValue(undefined) };
		const db = { Message: { findByPk: vi.fn().mockResolvedValue(null) } };
		const task = new SendMessagePerRecipientSMTP(account, {
			type: "SendMessagePerRecipient",
			status: "NEW",
			props: {
				messagePayload: { id: "message" },
				usesOpenTracking: true,
				usesLinkTracking: true,
			},
		});

		const result = await task.run(db, smtp);

		expect(smtp.sendCustom).toHaveBeenCalledTimes(3);
		expect(smtp.sendCustom).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({ body: "body:one@example.com" }),
			{ to: [{ email: "one@example.com" }] },
		);
		expect(baseMessage.body).toBe("stripped:original");
		expect(baseMessage.setIsSent).toHaveBeenCalledWith(true);
		expect(baseMessage.save).toHaveBeenCalled();
		expect(result).toEqual({
			message: { id: "message", body: "saved" },
			failedRecipients: [],
		});
	});

	it("reports an individual failure after the other recipient succeeds", async () => {
		const baseMessage = message();
		mocks.buildForSend.mockResolvedValue(baseMessage);
		const smtp = {
			sendCustom: vi
				.fn()
				.mockRejectedValueOnce(new Error("recipient rejected"))
				.mockResolvedValue(undefined),
		};
		const persisted = message();
		const db = { Message: { findByPk: vi.fn().mockResolvedValue(persisted) } };
		const result = await new SendMessagePerRecipientSMTP(account, {
			type: "SendMessagePerRecipient",
			status: "NEW",
			props: { messagePayload: {}, usesOpenTracking: false, usesLinkTracking: false },
		}).run(db, smtp);

		expect(result.failedRecipients).toEqual(["one@example.com"]);
		expect(persisted.save).toHaveBeenCalled();
	});

	it("turns total delivery failure into the task-level API error", async () => {
		mocks.buildForSend.mockResolvedValue(message());
		const smtp = { sendCustom: vi.fn().mockRejectedValue(new Error("offline")) };
		await expect(
			new SendMessagePerRecipientSMTP(account, {
				type: "SendMessagePerRecipient",
				status: "NEW",
				props: { messagePayload: {} },
			}).run({ Message: { findByPk: vi.fn() } }, smtp),
		).rejects.toThrow(/failed for all recipients/);
	});

	it("does not report delivery failure when only the local save fails", async () => {
		const baseMessage = message();
		baseMessage.save.mockRejectedValue(new Error("database unavailable"));
		mocks.buildForSend.mockResolvedValue(baseMessage);
		const result = await new SendMessagePerRecipientSMTP(account, {
			type: "SendMessagePerRecipient",
			status: "NEW",
			props: { messagePayload: {} },
		}).run(
			{ Message: { findByPk: vi.fn().mockResolvedValue(null) } },
			{ sendCustom: vi.fn().mockResolvedValue(undefined) },
		);
		expect(result).toEqual({ message: {}, failedRecipients: [] });
	});
});
