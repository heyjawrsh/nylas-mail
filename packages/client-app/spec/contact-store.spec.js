import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
	accounts: vi.fn(() => [{ id: "a" }, { id: "b" }]),
	background: vi.fn(),
	components: vi.fn(() => []),
	findAll: vi.fn(),
	limit: vi.fn(),
	listenTo: vi.fn(),
	rankings: vi.fn(() => ({})),
	reset: vi.fn(),
	search: vi.fn(),
	trigger: vi.fn(),
}));

vi.mock("nylas-store", () => ({
	default: class NylasStore {
		listenTo(...args) { return m.listenTo(...args); }
		trigger(...args) { return m.trigger(...args); }
	},
}));
vi.mock("node:fs", () => ({ default: {} }));
vi.mock("node:path", () => ({ default: {} }));
vi.mock("underscore", () => ({
	default: {
		values: (obj) => Object.values(obj || {}),
		uniq: (arr, fn) => {
			const seen = new Set();
			return (arr || []).filter((item) => {
				const key = fn ? fn(item) : item;
				if (seen.has(key)) return false;
				seen.add(key);
				return true;
			});
		},
		extend: Object.assign,
	},
}));
vi.mock("../src/flux/actions.js", () => ({ default: {} }));
vi.mock("../src/flux/models/contact.js", () => ({
	default: class Contact {
		constructor(attrs) { Object.assign(this, attrs); }
		isValid() { return Boolean(this.email); }
	},
}));
vi.mock("../src/flux/models/utils.js", () => ({ default: {} }));
vi.mock("../src/flux/stores/database-store.js", () => ({ default: { findAll: m.findAll } }));
vi.mock("../src/flux/stores/account-store.js", () => ({ default: { accounts: m.accounts } }));
vi.mock("../src/flux/stores/contact-ranking-store.js", () => ({
	default: { valuesForAllAccounts: m.rankings, reset: m.reset },
	valuesForAllAccounts: m.rankings,
	reset: m.reset,
}));
vi.mock("../src/registries/component-registry.js", () => ({
	default: { findComponentsMatching: m.components },
	findComponentsMatching: m.components,
}));
vi.mock("../src/regexp-utils.js", () => ({
	default: { emailRegex: () => /[\w.+-]+@[\w.-]+\.[A-Za-z]+/g },
	emailRegex: () => /[\w.+-]+@[\w.-]+\.[A-Za-z]+/g,
}));
vi.mock("../src/window-bridge.js", () => ({ default: {} }));
vi.mock("reflux", () => ({ default: {} }));
vi.mock("rx-lite", () => ({ default: {} }));

// The target uses CJS require(), so these mocks document its dependency surface
// while the assertions stay on the exported singleton's public/prototype API.
import ContactStore from "../src/flux/stores/contact-store.js";

// Unlike Promise.props, setup.js does not polyfill this remaining Bluebird API.
Promise.each ??= (items, iterator) => items.reduce(
	(chain, item) => chain.then(() => iterator(item)),
	Promise.resolve(),
);

const contact = (email, name = email) => ({ email, name });

describe("ContactStore aggregation", () => {
	let store;

	beforeEach(() => {
		vi.clearAllMocks();
		m.accounts.mockReturnValue([{ id: "a" }, { id: "b" }]);
		m.components.mockReturnValue([]);
		m.rankings.mockReturnValue({});
		store = ContactStore;
	});

	it("drops contacts without email addresses", () => {
		expect(store._distinctByEmail([contact(null, "Nobody"), contact("a@x.com")])).toEqual([contact("a@x.com")]);
	});

	it("deduplicates email addresses case-insensitively", () => {
		const results = store._distinctByEmail([contact("A@x.com"), contact("a@x.com")]);
		expect(results).toHaveLength(1);
	});

	it("prefers a duplicate which has a real name", () => {
		const named = contact("a@x.com", "Ada");
		expect(store._distinctByEmail([contact("a@x.com"), named])).toEqual([named]);
	});

	it("keeps the first named duplicate", () => {
		const first = contact("a@x.com", "Ada");
		expect(store._distinctByEmail([first, contact("A@x.com", "Other")])).toEqual([first]);
	});

	it("parses a bare email address", async () => {
		const [result] = await store.parseContactsInString("ada@example.com", { skipNameLookup: true });
		expect(result).toMatchObject({ email: "ada@example.com", name: "ada@example.com" });
	});

	it("parses multiple contacts", async () => {
		const results = await store.parseContactsInString("a@example.com, b@example.com", { skipNameLookup: true });
		expect(results.map((item) => item.email)).toEqual(["a@example.com", "b@example.com"]);
	});

	it("associates a name with an angle-bracket email", async () => {
		const [result] = await store.parseContactsInString("Ada Lovelace <ada@example.com>", { skipNameLookup: true });
		expect(result.name).toBe("Ada Lovelace");
	});

	it("removes matching quotes around a parsed name", async () => {
		const [result] = await store.parseContactsInString('"Ada Lovelace" <ada@example.com>', { skipNameLookup: true });
		expect(result.name).toBe("Ada Lovelace");
	});

	it("keeps names separated by newlines with their own contacts", async () => {
		const results = await store.parseContactsInString("Ada <a@example.com>\nGrace <g@example.com>", { skipNameLookup: true });
		expect(results.map((item) => item.name)).toEqual(["Ada", "Grace"]);
	});

	it("returns an empty aggregate when no email is present", async () => {
		await expect(store.parseContactsInString("Ada Lovelace", { skipNameLookup: true })).resolves.toEqual([]);
	});

	it("recognizes contacts produced by its parser as valid", async () => {
		const [result] = await store.parseContactsInString("ada@example.com", { skipNameLookup: true });
		expect(store.isValidContact(result)).toBe(true);
	});

	it("rejects contact-shaped plain objects", () => {
		expect(store.isValidContact(contact("ada@example.com", "Ada"))).toBe(false);
	});
});
