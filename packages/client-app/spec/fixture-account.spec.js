// @vitest-environment node
// The offline fixture account (spec/fixtures/account, seeded into a NYLAS_HOME
// by scripts/seed-fixture-account.mjs).
import { describe, expect, it } from "vitest";
import { fixtureConfig, fixtureData } from "../scripts/seed-fixture-account.mjs";

describe("fixture account data", () => {
	const { account, mailbox } = fixtureData();

	it("puts the one account in config, so the app opens the main window", () => {
		const config = fixtureConfig(account);
		expect(config["*"].nylas.accounts).toEqual([account]);
		expect(config["*"].nylas.accountsVersion).toBe(1);
		expect(account).toMatchObject({ id: "fixture-account", organization_unit: "folder" });
	});

	it("uses only reserved .test addresses, so nothing can reach a real mailbox", () => {
		const emails = [account.email_address, ...mailbox.contacts.map((c) => c.email)];
		expect(emails.every((e) => e.endsWith("@fixture.test"))).toBe(true);
	});

	it("has an inbox and the standard folders", () => {
		expect(mailbox.folders.map((f) => f.name)).toEqual(
			expect.arrayContaining(["inbox", "sent", "drafts", "archive", "trash", "spam"]),
		);
	});

	it("gives every thread messages, from known contacts, in known folders", () => {
		const people = new Set(mailbox.contacts.map((c) => c.id.replace("fixture-contact-", "")));
		const folders = new Set(mailbox.folders.map((f) => f.name));
		expect(mailbox.threads.filter((t) => t.folders.includes("inbox")).length).toBeGreaterThanOrEqual(3);
		for (const thread of mailbox.threads) {
			expect(thread.messages.length).toBeGreaterThan(0);
			for (const name of thread.folders) expect(folders.has(name)).toBe(true);
			for (const message of thread.messages) {
				for (const who of [message.from, ...message.to, ...message.cc]) {
					expect(people.has(who)).toBe(true);
				}
				expect(Number.isNaN(Date.parse(message.date))).toBe(false);
				expect(message.body).toMatch(/^<p>/);
			}
		}
	});

	it("has a thread with several messages, so the message list collapses some", () => {
		expect(Math.max(...mailbox.threads.map((t) => t.messages.length))).toBeGreaterThanOrEqual(3);
	});
});
