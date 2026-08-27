import { beforeEach, describe, expect, it, vi } from "vitest";

const { findMessage } = vi.hoisted(() => ({ findMessage: vi.fn() }));

vi.mock("nylas-exports", () => ({
	DatabaseStore: {
		find: findMessage,
	},
}));

import Utils from "../src/flux/models/utils.js";
import Message from "../src/flux/models/message.js";
import DraftHelpers from "../src/flux/stores/draft-helpers.js";

const contact = (email, { name = "", me = false } = {}) => ({
	email,
	name,
	isMe: () => me,
	toString: () => (name ? `${name} <${email}>` : email),
});

const messageWith = (fields = {}) => ({
	to: [],
	cc: [],
	bcc: [],
	from: [],
	replyTo: [],
	isFromMe: Message.prototype.isFromMe,
	...fields,
});

describe("draft and message helpers", () => {
	describe("reply header computation", () => {
		it("builds an attribution from the formatted date and sender", () => {
			const value = Message.prototype.replyAttributionLine.call({
				formattedDate: () => "Aug 27 2026, at 2:30 pm",
				fromContact: () => contact("ada@example.com", { name: "Ada" }),
			});

			expect(value).toBe(
				"On Aug 27 2026, at 2:30 pm, Ada <ada@example.com> wrote:",
			);
		});

		it("uses the sender's email when the contact has no name", () => {
			const value = Message.prototype.replyAttributionLine.call({
				formattedDate: () => "Jan 1 2020, at 9:00 am",
				fromContact: () => contact("sender@example.com"),
			});

			expect(value).toBe(
				"On Jan 1 2020, at 9:00 am, sender@example.com wrote:",
			);
		});

		it("selects the first sender for the attribution", () => {
			const first = contact("first@example.com");
			const second = contact("second@example.com");

			expect(
				Message.prototype.fromContact.call({ from: [first, second] }),
			).toBe(first);
		});

		it("formats the reply date in the message's canonical shape", () => {
			const formatted = Message.prototype.formattedDate.call({
				date: new Date(2026, 7, 27, 14, 5),
			});

			expect(formatted).toBe("Aug 27 2026, at 2:05 pm");
		});
	});

	describe("forward subject derivation", () => {
		it("adds Fwd: to an unprefixed subject", () => {
			expect(Utils.subjectWithPrefix("Quarterly plan", "Fwd:")).toBe(
				"Fwd: Quarterly plan",
			);
		});

		it("replaces Re: with Fwd:", () => {
			expect(Utils.subjectWithPrefix("Re: Quarterly plan", "Fwd:")).toBe(
				"Fwd: Quarterly plan",
			);
		});

		it("does not duplicate an existing Fwd: prefix", () => {
			expect(Utils.subjectWithPrefix("Fwd: Quarterly plan", "Fwd:")).toBe(
				"Fwd: Quarterly plan",
			);
		});

		it("normalizes a lowercase reply prefix", () => {
			expect(Utils.subjectWithPrefix("re: status", "Fwd:")).toBe(
				"Fwd: status",
			);
		});

		it("normalizes a mixed-case forward prefix", () => {
			expect(Utils.subjectWithPrefix("FwD: status", "Fwd:")).toBe(
				"Fwd: status",
			);
		});

		it("derives a forward subject for an empty subject", () => {
			expect(Utils.subjectWithPrefix("", "Fwd:")).toBe("Fwd: ");
		});
	});

	describe("recipient assembly", () => {
		it("replies to the sender of an incoming message", () => {
			const sender = contact("sender@example.com");
			const result = Message.prototype.participantsForReply.call(
				messageWith({ from: [sender] }),
			);

			expect(result).toEqual({ to: [sender], cc: [] });
		});

		it("replies to original recipients for a sent message", () => {
			const recipient = contact("recipient@example.com");
			const result = Message.prototype.participantsForReply.call(
				messageWith({
					from: [contact("me@example.com", { me: true })],
					to: [recipient],
				}),
			);

			expect(result.to).toEqual([recipient]);
		});

		it("prefers Reply-To over the sender", () => {
			const replyTo = contact("replies@example.com");
			const result = Message.prototype.participantsForReply.call(
				messageWith({
					from: [contact("sender@example.com")],
					replyTo: [replyTo],
				}),
			);

			expect(result.to).toEqual([replyTo]);
		});

		it("deduplicates reply recipients by normalized email", () => {
			const first = contact("person@gmail.com");
			const duplicate = contact("person+news@gmail.com");
			const result = Message.prototype.participantsForReply.call(
				messageWith({ replyTo: [first, duplicate] }),
			);

			expect(result.to).toEqual([first]);
		});

		it("reply-all puts an incoming sender in To", () => {
			const sender = contact("sender@example.com");
			const result = Message.prototype.participantsForReplyAll.call(
				messageWith({ from: [sender] }),
			);

			expect(result.to).toEqual([sender]);
		});

		it("reply-all preserves non-self To recipients in Cc", () => {
			const other = contact("other@example.com");
			const result = Message.prototype.participantsForReplyAll.call(
				messageWith({
					from: [contact("sender@example.com")],
					to: [contact("me@example.com", { me: true }), other],
				}),
			);

			expect(result.cc).toEqual([other]);
		});

		it("reply-all excludes the current user from Cc", () => {
			const result = Message.prototype.participantsForReplyAll.call(
				messageWith({
					from: [contact("sender@example.com")],
					cc: [contact("me@example.com", { me: true })],
				}),
			);

			expect(result.cc).toEqual([]);
		});

		it("reply-all excludes a sender duplicated among recipients", () => {
			const sender = contact("sender@example.com");
			const result = Message.prototype.participantsForReplyAll.call(
				messageWith({ from: [sender], cc: [contact("sender@example.com")] }),
			);

			expect(result).toEqual({ to: [sender], cc: [] });
		});

		it("reply-all uses Reply-To and assembles the remaining recipients", () => {
			const replyTo = contact("list@example.com");
			const colleague = contact("colleague@example.com");
			const result = Message.prototype.participantsForReplyAll.call(
				messageWith({
					from: [contact("sender@example.com")],
					replyTo: [replyTo],
					to: [contact("me@example.com", { me: true })],
					cc: [colleague],
				}),
			);

			expect(result).toEqual({ to: [replyTo], cc: [colleague] });
		});
	});

	describe("quote body assembly", () => {
		beforeEach(() => {
			findMessage.mockReset();
		});

		it("appends a quote wrapper and sanitized previous body", async () => {
			const previous = {
				body: "<p>Previous message</p>",
				replyAttributionLine: () => "On Thursday, Ada <ada@example.com> wrote:",
			};
			findMessage.mockReturnValue({ include: () => Promise.resolve(previous) });
			vi.spyOn(DraftHelpers, "prepareBodyForQuoting").mockResolvedValueOnce(
				"<p>Safe previous message</p>",
			);

			const draft = await DraftHelpers.appendQuotedTextToDraft({
				body: "<p>My reply</p>",
				replyToMessageId: "message-1",
			});

			expect(draft.body).toContain("<p>My reply</p>");
			expect(draft.body).toContain("<p>Safe previous message</p>");
			expect(draft.body).toContain("nylas-quote-id-message-1");
		});

		it("escapes attribution text before placing it in HTML", async () => {
			const previous = {
				body: "old",
				replyAttributionLine: () => "A <sender@example.com> wrote:",
			};
			findMessage.mockReturnValue({ include: () => Promise.resolve(previous) });
			vi.spyOn(DraftHelpers, "prepareBodyForQuoting").mockResolvedValueOnce("old");

			const draft = await DraftHelpers.appendQuotedTextToDraft({
				body: "new",
				replyToMessageId: "message-2",
			});

			expect(draft.body).toContain("A &lt;sender@example.com&gt; wrote:");
		});

		it("returns the draft unchanged when the previous message is missing", async () => {
			findMessage.mockReturnValue({ include: () => Promise.resolve(null) });
			const original = { body: "reply", replyToMessageId: "missing" };

			await expect(DraftHelpers.appendQuotedTextToDraft(original)).resolves.toBe(
				original,
			);
			expect(original.body).toBe("reply");
		});

		it("identifies a draft that still needs its quoted text", () => {
			expect(
				DraftHelpers.shouldAppendQuotedText({
					body: "<p>Fresh reply</p>",
					replyToMessageId: "message-3",
				}),
			).toBe(true);
		});

		it("does not append the same message quote twice", () => {
			expect(
				DraftHelpers.shouldAppendQuotedText({
					body: '<div class="nylas-quote-id-message-4">Old message</div>',
					replyToMessageId: "message-4",
				}),
			).toBe(false);
		});
	});
});
