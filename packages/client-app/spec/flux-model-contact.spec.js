import { describe, expect, it, vi } from "vitest";
import Contact from "../src/flux/models/contact.js";

vi.mock("../src/flux/stores/account-store.js", () => ({
	default: {
		accountForEmail: vi.fn(() => null),
		emailAddresses: vi.fn(() => []),
	},
}));

const contactFromJSON = (json = {}) => new Contact().fromJSON(json);

describe("Contact", () => {
	it("inflates API JSON", () => {
		const contact = contactFromJSON({
			id: "contact-1",
			account_id: "account-1",
			name: "Ada Lovelace",
			email: "ada@example.com",
		});

		expect(contact.id).toBe("contact-1");
		expect(contact.accountId).toBe("account-1");
		expect(contact.name).toBe("Ada Lovelace");
		expect(contact.email).toBe("ada@example.com");
	});

	it("round trips normalized fields", () => {
		const contact = contactFromJSON({
			name: "Grace Hopper",
			email: "grace@example.com",
			title: "Admiral",
			phone: "555-0100",
			company: "Navy",
			thirdPartyData: { source: "address-book" },
		});

		const copy = contactFromJSON(contact.toJSON());
		expect(copy.toJSON()).toEqual(contact.toJSON());
	});

	it("maps search index JSON keys", () => {
		const contact = contactFromJSON({
			is_search_indexed: true,
			search_index_id: 42,
		});

		expect(contact.isSearchIndexed).toBe(true);
		expect(contact.searchIndexId).toBe(42);
	});

	it("defaults third-party data to an object", () => {
		expect(contactFromJSON().thirdPartyData).toEqual({});
	});

	it("uses the name and email in its email string", () => {
		const contact = contactFromJSON({
			name: "Ada Lovelace",
			email: "ada@example.com",
		});
		expect(contact.toString()).toBe("Ada Lovelace <ada@example.com>");
	});

	it("uses only the email when the name is absent", () => {
		expect(contactFromJSON({ email: "ada@example.com" }).toString()).toBe(
			"ada@example.com",
		);
	});

	it("uses only the email when name and email match", () => {
		const contact = contactFromJSON({
			name: "ada@example.com",
			email: "ada@example.com",
		});
		expect(contact.toString()).toBe("ada@example.com");
	});

	it("fills a missing JSON name with the email", () => {
		const json = contactFromJSON({ email: "ada@example.com" }).toJSON();
		expect(json.name).toBe("ada@example.com");
	});

	it("returns the full display name", () => {
		const contact = contactFromJSON({
			name: "Ada Byron Lovelace",
			email: "ada@example.com",
		});
		expect(contact.displayName()).toBe("Ada Byron Lovelace");
	});

	it("returns a compact display name", () => {
		const contact = contactFromJSON({
			name: "Ada Byron Lovelace",
			email: "ada@example.com",
		});
		expect(contact.displayName({ compact: true })).toBe("Ada");
	});

	it("removes a title from name parts", () => {
		const contact = contactFromJSON({ name: "Dr. Ada Lovelace" });
		expect(contact.fullName()).toBe("Ada Lovelace");
	});

	it("removes a suffix from name parts", () => {
		const contact = contactFromJSON({ name: "Martin Luther King Jr." });
		expect(contact.fullName()).toBe("Martin Luther King");
	});

	it("parses reverse-order names", () => {
		const contact = contactFromJSON({ name: "Lovelace, Ada" });
		expect(contact.firstName()).toBe("Ada");
		expect(contact.lastName()).toBe("Lovelace");
	});

	it("falls back to the email local part for names", () => {
		const contact = contactFromJSON({ email: "ada.lovelace@example.com" });
		expect(contact.fullName()).toBe("ada.lovelace");
	});

	it("drops a via attribution while parsing a name", () => {
		const contact = contactFromJSON({ name: "Ada Lovelace via LinkedIn" });
		expect(contact.fullName()).toBe("Ada Lovelace");
	});

	it("builds a two-letter name abbreviation", () => {
		const contact = contactFromJSON({ name: "Ada Lovelace" });
		expect(contact.nameAbbreviation()).toBe("AL");
	});

	it("validates a complete email address", () => {
		expect(contactFromJSON({ email: "ada@example.com" }).isValid()).toBe(true);
	});

	it("rejects an invalid email address", () => {
		expect(contactFromJSON({ email: "not an email" }).isValid()).toBe(false);
	});

	it("rejects a missing email address", () => {
		expect(contactFromJSON({ name: "Ada" }).isValid()).toBe(false);
	});

	it("exposes its full-text search metadata", () => {
		expect(Contact.searchable).toBe(true);
		expect(Contact.searchFields).toEqual(["content"]);
	});

	it("matches an email query", () => {
		const contact = contactFromJSON({ email: "ada@example.com" });
		const matcher = Contact.attributes.email.like("ADA@EXAMPLE");
		expect(contact.matches([matcher])).toBe(true);
	});

	it("does not match an unrelated name query", () => {
		const contact = contactFromJSON({ name: "Ada Lovelace" });
		const matcher = Contact.attributes.name.like("Grace");
		expect(contact.matches([matcher])).toBe(false);
	});

	it("guesses a company from a custom email domain", () => {
		const contact = contactFromJSON({ email: "ada@analytical-engine.org" });
		expect(contact.guessCompanyFromEmail()).toBe("Analytical Engine");
	});
});
