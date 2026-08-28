import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	generateFakeServerId: vi.fn(() => "proposal-generated"),
}));

vi.mock("nylas-exports", () => ({
	default: { Utils: { generateFakeServerId: mocks.generateFakeServerId } },
	Utils: { generateFakeServerId: mocks.generateFakeServerId },
}));

import Proposal from "../internal_packages/composer-scheduler/lib/proposal.js";
import { prepareEvent } from "../internal_packages/composer-scheduler/lib/composer/event-prep-helper.js";

describe("composer scheduler Proposal", () => {
	beforeEach(() => vi.clearAllMocks());

	it("generates an id for an empty proposal", () => {
		const proposal = new Proposal();
		expect(proposal.id).toBe("proposal-generated");
		expect(mocks.generateFakeServerId).toHaveBeenCalledOnce();
	});

	it("copies proposal properties", () => {
		const proposal = new Proposal({ start: 10, end: 20, label: "Coffee" });
		expect(proposal).toMatchObject({ start: 10, end: 20, label: "Coffee" });
	});

	it("allows a supplied id to replace the generated id", () => {
		const proposal = new Proposal({ id: "proposal-saved" });
		expect(proposal.id).toBe("proposal-saved");
	});

	it("mirrors the final id into proposalId", () => {
		const proposal = new Proposal({ id: "proposal-saved", proposalId: "stale" });
		expect(proposal.proposalId).toBe("proposal-saved");
	});
});

describe("composer scheduler prepareEvent", () => {
	const draftWith = (participants) => ({ participants: vi.fn(() => participants) });

	it("returns and mutates the supplied event", () => {
		const event = { title: "Planning" };
		// Legacy callers rely on preparation updating the event object in place.
		expect(prepareEvent(event, draftWith([]))).toBe(event);
		expect(event.participants).toEqual([]);
	});

	it("normalizes a missing title to an empty string", () => {
		const event = {};
		prepareEvent(event, draftWith([]));
		expect(event.title).toBe("");
	});

	it("preserves an existing title", () => {
		const event = { title: "Demo" };
		prepareEvent(event, draftWith([]));
		expect(event.title).toBe("Demo");
	});

	it("copies only participant names and emails and sets noreply status", () => {
		const event = {};
		prepareEvent(event, draftWith([{ name: "Ada", email: "ada@example.com", id: "c1" }]));
		expect(event.participants).toEqual([
			{ name: "Ada", email: "ada@example.com", status: "noreply" },
		]);
	});

	it("clears fixed start and end times when proposals exist", () => {
		const event = { start: 100, end: 200 };
		prepareEvent(event, draftWith([]), [{ start: 300, end: 400 }]);
		expect(event).toMatchObject({ start: null, end: null });
	});

	it("keeps fixed start and end times without proposals", () => {
		const event = { start: 100, end: 200 };
		prepareEvent(event, draftWith([]));
		expect(event).toMatchObject({ start: 100, end: 200 });
	});
});
