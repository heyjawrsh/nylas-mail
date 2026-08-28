import { describe, expect, it, vi } from "vitest";

vi.mock("../src/flux/attributes.js", () => {
	const attribute = (options) => ({ ...options });
	return {
		default: {
			String: attribute,
			Object: attribute,
		},
	};
});

vi.mock("../src/flux/models/model-with-metadata.js", () => ({
	default: class ModelWithMetadata {
		static attributes = {};

		constructor(values = {}) {
			Object.assign(this, values);
		}

		fromJSON(json = {}) {
			const keys = {
				email_address: "emailAddress",
				organization_unit: "organizationUnit",
				default_alias: "defaultAlias",
				sync_state: "syncState",
				sync_error: "syncError",
				n1_cloud_state: "n1CloudState",
				account_id: "accountId",
			};
			for (const [key, value] of Object.entries(json)) {
				this[keys[key] || key] = value;
			}
			return this;
		}
	},
}));

import Account from "../src/flux/models/account.js";

describe("Account helpers", () => {
	it("defaults aliases, label, and sync state", () => {
		const account = new Account({ emailAddress: "ada@example.com" });
		expect(account.aliases).toEqual([]);
		expect(account.label).toBe("ada@example.com");
		expect(account.syncState).toBe(Account.SYNC_STATE_RUNNING);
	});

	it("preserves explicit constructor values", () => {
		const aliases = ["alias@example.com"];
		const account = new Account({ aliases, label: "Work", syncState: "paused" });
		expect(account).toMatchObject({ aliases, label: "Work", syncState: "paused" });
	});

	it("maps API JSON keys and returns itself", () => {
		const account = new Account();
		expect(account.fromJSON({
			email_address: "ada@example.com",
			organization_unit: "label",
			default_alias: "Ada <alias@example.com>",
			sync_state: "invalid",
			n1_cloud_state: "n1_cloud_auth_failed",
		})).toBe(account);
		expect(account).toMatchObject({
			emailAddress: "ada@example.com",
			organizationUnit: "label",
			defaultAlias: "Ada <alias@example.com>",
			syncState: "invalid",
			n1CloudState: "n1_cloud_auth_failed",
		});
	});

	it("fills a missing JSON label from the email address", () => {
		const account = new Account().fromJSON({ email_address: "ada@example.com" });
		expect(account.label).toBe("ada@example.com");
	});

	it("preserves a label supplied by JSON", () => {
		const account = new Account().fromJSON({ email_address: "ada@example.com", label: "Personal" });
		expect(account.label).toBe("Personal");
	});

	it("recognizes label organization", () => {
		const account = new Account({ organizationUnit: "label" });
		expect(account.usesLabels()).toBe(true);
		expect(account.usesFolders()).toBe(false);
	});

	it("recognizes folder organization", () => {
		const account = new Account({ organizationUnit: "folder" });
		expect(account.usesFolders()).toBe(true);
		expect(account.usesLabels()).toBe(false);
	});

	it("labels known category collections", () => {
		expect(new Account({ organizationUnit: "folder" }).categoryLabel()).toBe("Folders");
		expect(new Account({ organizationUnit: "label" }).categoryLabel()).toBe("Labels");
	});

	it("reports unknown category organization", () => {
		const account = new Account({ organizationUnit: "mystery" });
		expect(account.categoryLabel()).toBe("Unknown");
		// Actual behavior pluralizes any value, even an unsupported one.
		expect(account.categoryCollection()).toBe("mysterys");
	});

	it("chooses category icons", () => {
		expect(new Account({ organizationUnit: "label" }).categoryIcon()).toBe("tag.png");
		expect(new Account({ organizationUnit: "folder" }).categoryIcon()).toBe("folder.png");
		expect(new Account().categoryIcon()).toBe("folder.png");
	});

	it("formats known provider names", () => {
		expect(new Account({ provider: "eas" }).displayProvider()).toBe("Exchange");
		expect(new Account({ provider: "gmail" }).displayProvider()).toBe("Gmail");
	});

	it("passes unknown provider names through", () => {
		expect(new Account({ provider: "imap" }).displayProvider()).toBe("imap");
	});

	it("creates the current-user contact", () => {
		const me = new Account({ id: "a1", name: "Ada", emailAddress: "ada@example.com" }).me();
		expect(me).toMatchObject({ accountId: "a1", name: "Ada", email: "ada@example.com" });
	});

	it("uses the primary identity when an alias is absent", () => {
		const account = new Account({ id: "a1", emailAddress: "ada@example.com" });
		expect(account.meUsingAlias().email).toBe("ada@example.com");
	});

	it("parses a string alias with the account ID", () => {
		const alias = new Account({ id: "a1" }).meUsingAlias("Ada Alias <alias@example.com>");
		expect(alias).toMatchObject({ accountId: "a1", name: "Ada Alias", email: "alias@example.com" });
	});

	it("uses the default alias when configured", () => {
		const account = new Account({ id: "a1", emailAddress: "ada@example.com", defaultAlias: "alias@example.com" });
		expect(account.defaultMe().email).toBe("alias@example.com");
	});

	it("detects cloud and sync errors", () => {
		const account = new Account({ n1CloudState: Account.N1_CLOUD_STATE_AUTH_FAILED, syncState: "sync_error" });
		expect(account.hasN1CloudError()).toBe(true);
		expect(account.hasSyncStateError()).toBe(true);
	});

	it("treats only the running sync state as healthy", () => {
		const account = new Account({ n1CloudState: Account.N1_CLOUD_STATE_RUNNING, syncState: Account.SYNC_STATE_RUNNING });
		expect(account.hasN1CloudError()).toBe(false);
		expect(account.hasSyncStateError()).toBe(false);
	});
});
