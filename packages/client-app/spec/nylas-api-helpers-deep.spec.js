import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => {
	class Message { static attributes = { id: { in: (ids) => ({ ids }) } }; }
	class Thread {
		static attributes = { id: { in: (ids) => ({ ids }) } };
		clone() { return Object.assign(new Thread(), this); }
		fromJSON(json) { Object.assign(this, json); }
	}
	return {
		Message, Thread,
		acceptRemoteChangesTo: vi.fn(() => true),
		findAll: vi.fn(),
		inTransaction: vi.fn(),
		incrementRemoteChangeLock: vi.fn(),
		requestInstances: [],
		run: vi.fn(),
	};
});

vi.mock("node:module", () => {
	const createRequire = () => vi.fn(() => ({}));
	return { default: { createRequire }, createRequire };
});
vi.mock("underscore", () => {
	const underscore = {
		filter: (items, predicate) => items.filter(predicate),
		pluck: (items, key) => items.map((item) => item[key]),
		uniq: (items, _sorted, iteratee) => {
			const seen = new Set();
			return items.filter((item) => {
				const key = iteratee ? iteratee(item) : item;
				if (seen.has(key)) return false;
				seen.add(key);
				return true;
			});
		},
	};
	return { default: underscore, ...underscore };
});
vi.mock("../src/flux/nylas-api.js", () => ({
	default: {
		incrementRemoteChangeLock: m.incrementRemoteChangeLock,
		lockTracker: { acceptRemoteChangesTo: m.acceptRemoteChangesTo },
	},
}));
vi.mock("../src/flux/nylas-api-request.js", () => ({
	default: class NylasAPIRequest {
		constructor(config) { this.config = config; m.requestInstances.push(this); }
		run() { return m.run(); }
	},
}));
vi.mock("../src/flux/stores/database-store.js", () => ({
	default: { findAll: m.findAll, inTransaction: m.inTransaction },
}));
vi.mock("../src/flux/models/message.js", () => ({
	default: m.Message,
}));
vi.mock("../src/flux/models/thread.js", () => ({
	default: m.Thread,
}));
vi.mock("node:url", () => {
	const url = { parse: (value) => new URL(value, "https://api.test") };
	return { default: url, ...url };
});

class Model {
	static attributes = { id: { in: (ids) => ({ ids }) } };
	clone() { return Object.assign(new Model(), this); }
	fromJSON(json) { Object.assign(this, json); }
}
class FileModel extends Model {}
class EventModel extends Model {}
class LabelModel extends Model {}
class FolderModel extends Model {}
class AccountModel extends Model {}
class ContactModel extends Model {}
class CalendarModel extends Model {}

globalThis.$n = {
	File: FileModel, Event: EventModel, Label: LabelModel, Folder: FolderModel,
	Thread: m.Thread, Draft: class Draft extends Model {},
	Account: AccountModel, Message: m.Message,
	Contact: ContactModel, Calendar: CalendarModel,
};
globalThis.NylasEnv = { inSpecMode: vi.fn(() => true) };

const helpers = await import("../src/flux/nylas-api-helpers.js");
const { default: NylasAPI } = await import("../src/flux/nylas-api.js");
const { default: Message } = await import("../src/flux/models/message.js");
const { default: Thread } = await import("../src/flux/models/thread.js");

function transaction(models = []) {
	const t = {
		find: vi.fn(), persistModels: vi.fn().mockResolvedValue(undefined),
		unpersistModel: vi.fn().mockResolvedValue(undefined),
	};
	m.findAll.mockReturnValue({ where: vi.fn().mockResolvedValue(models) });
	m.inTransaction.mockImplementation((fn) => fn(t));
	return t;
}

describe("Nylas API helper model responses", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		m.requestInstances.length = 0;
		m.acceptRemoteChangesTo.mockReturnValue(true);
		transaction();
	});

	it("rejects a missing response", async () => {
		await expect(helpers.handleModelResponse()).rejects.toThrow("no JSON provided");
	});

	it("returns an empty result for an empty response", async () => {
		await expect(helpers.handleModelResponse([])).resolves.toEqual([]);
	});

	it("normalizes a single API object into one model", async () => {
		const result = await helpers.handleModelResponse({ id: "c1", object: "contact", name: "Ada" });
		expect(result).toHaveLength(1);
	});

	it("returns no models for an unknown API object type", async () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		await expect(helpers.handleModelResponse([{ id: "x", object: "mystery" }])).resolves.toEqual([]);
		warn.mockRestore();
	});

	it("deduplicates response objects by id", async () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const result = await helpers.handleModelResponse([{ id: "c1", object: "contact" }, { id: "c1", object: "contact" }]);
		expect(result).toHaveLength(1);
		warn.mockRestore();
	});

	it("warns when duplicate objects are received", async () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		await helpers.handleModelResponse([{ id: "c1", object: "contact" }, { id: "c1", object: "contact" }]);
		expect(warn).toHaveBeenCalledWith(expect.stringContaining("non-unique"));
		warn.mockRestore();
	});

	it("filters a model rejected by the remote-change lock", async () => {
		m.acceptRemoteChangesTo.mockReturnValue(false);
		await expect(helpers.handleModelResponse([{ id: "c1", object: "contact" }])).resolves.toEqual([]);
	});

	it("annotates the delta when a locked model is ignored", async () => {
		m.acceptRemoteChangesTo.mockReturnValue(false);
		const delta = {};
		await helpers.handleModelResponse([{ id: "c1", object: "contact", _delta: delta }]);
		expect(delta.ignoredBecause).toContain("locked");
	});

	it("queries ordinary models using their remote ids", async () => {
		await helpers.handleModelResponse([{ id: "c1", object: "contact" }, { id: "c2", object: "contact" }]);
		const query = m.findAll.mock.results[0].value;
		expect(query.where).toHaveBeenCalledWith({ ids: ["c1", "c2"] });
	});

	it("returns no thread models when a response has no message ids", async () => {
		await expect(helpers.handleModelResponse([{ id: "t1", object: "thread", message_ids: [] }])).resolves.toEqual([]);
	});

	it("queries threads using local ids derived from message ids", async () => {
		await helpers.handleModelResponse([{ id: "remote-t", object: "thread", message_ids: ["m1", "m2"] }]);
		const query = m.findAll.mock.results[0].value;
		expect(query.where).toHaveBeenCalledWith({ ids: ["t:m1", "t:m2"] });
	});

	it("updates an existing ordinary model", async () => {
		const existing = Object.assign(new ContactModel(), { id: "c1", name: "Old" });
		const t = transaction([existing]);
		await helpers.handleModelResponse([{ id: "c1", object: "contact", name: "New" }]);
		expect(t.persistModels).toHaveBeenCalledWith([expect.objectContaining({ name: "New" })]);
	});

	it("does not overwrite an existing newer version", async () => {
		const existing = Object.assign(new ContactModel(), { id: "c1", version: 3, name: "Local" });
		const t = transaction([existing]);
		await helpers.handleModelResponse([{ id: "c1", object: "contact", version: 2, name: "Remote" }]);
		expect(t.persistModels).toHaveBeenCalledWith([]);
	});

	it("annotates a delta rejected for having an older version", async () => {
		transaction([Object.assign(new ContactModel(), { id: "c1", version: 3 })]);
		const delta = {};
		await helpers.handleModelResponse([{ id: "c1", object: "contact", version: 2, _delta: delta }]);
		expect(delta.ignoredBecause).toBe("JSON v2 <= model v3");
	});

	it("does not turn a sent model back into a draft", async () => {
		const existing = Object.assign(new ContactModel(), { id: "c1", draft: false });
		const t = transaction([existing]);
		await helpers.handleModelResponse([{ id: "c1", object: "contact", draft: true }]);
		expect(t.persistModels).toHaveBeenCalledWith([]);
	});

	it("unpersists the obsolete local thread id after a remote-id merge", async () => {
		const existing = Object.assign(new Thread(), { id: "t:m1" });
		const t = transaction([existing]);
		await helpers.handleModelResponse([{ id: "remote-t", object: "thread", message_ids: ["m1"] }]);
		expect(t.unpersistModel).toHaveBeenCalledWith(expect.objectContaining({ id: "t:m1" }));
	});
});

describe("Nylas API helper requests and cleanup", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		m.requestInstances.length = 0;
		m.run.mockResolvedValue([]);
	});

	it("skips draft deletion when the draft has no server id", () => {
		helpers.makeDraftDeletionRequest({ accountId: "a1", version: 4 });
		expect(m.requestInstances).toHaveLength(0);
	});

	it("locks the remote message before deleting a draft", () => {
		helpers.makeDraftDeletionRequest({ serverId: "d1", accountId: "a1", version: 4 });
		expect(m.incrementRemoteChangeLock).toHaveBeenCalledWith(Message, "d1");
	});

	it("builds the draft deletion path", () => {
		helpers.makeDraftDeletionRequest({ serverId: "d1", accountId: "a1", version: 4 });
		expect(m.requestInstances[0].config.options.path).toBe("/drafts/d1");
	});

	it("builds a DELETE request for draft deletion", () => {
		helpers.makeDraftDeletionRequest({ serverId: "d1", accountId: "a1", version: 4 });
		expect(m.requestInstances[0].config.options.method).toBe("DELETE");
	});

	it("includes the draft version in the deletion body", () => {
		helpers.makeDraftDeletionRequest({ serverId: "d1", accountId: "a1", version: 4 });
		expect(m.requestInstances[0].config.options.body).toEqual({ version: 4 });
	});

	it("runs the draft deletion request", () => {
		helpers.makeDraftDeletionRequest({ serverId: "d1", accountId: "a1", version: 4 });
		expect(m.run).toHaveBeenCalledOnce();
	});

	it("throws when a collection request lacks an account id", () => {
		expect(() => helpers.getCollection(null, "messages")).toThrow("requires accountId");
	});

	it("lets generated collection fields override conflicting request options", async () => {
		await helpers.getCollection("a1", "messages", { limit: 10 }, { path: "/wrong", accountId: "wrong", qs: {} });
		expect(m.requestInstances[0].config.options).toMatchObject({ path: "/messages", accountId: "a1", qs: { limit: 10 } });
	});

	it("preserves additional collection request options", async () => {
		await helpers.getCollection("a1", "messages", {}, { timeout: 250 });
		expect(m.requestInstances[0].config.options.timeout).toBe(250);
	});

	it("attaches requested metadata to matching response objects", async () => {
		const response = [{ id: "c1", object: "contact" }];
		m.run.mockResolvedValue(response);
		transaction();
		await helpers.getCollection("a1", "contacts", {}, { metadataToAttach: { c1: { color: "red" } } });
		expect(response[0].metadata).toEqual({ color: "red" });
	});

	it("leaves unmatched response metadata unchanged", async () => {
		const response = [{ id: "c1", object: "contact" }];
		m.run.mockResolvedValue(response);
		transaction();
		await helpers.getCollection("a1", "contacts", {}, { metadataToAttach: { other: { color: "red" } } });
		expect(response[0]).not.toHaveProperty("metadata");
	});

	it("preserves the original request error", async () => {
		const error = Object.assign(new Error("offline"), { statusCode: 503 });
		m.run.mockRejectedValue(error);
		await expect(helpers.getCollection("a1", "contacts")).rejects.toBe(error);
	});

	it("unpersists a locally cached model after a model 404", async () => {
		const model = { id: "c1" };
		const t = transaction();
		t.find.mockResolvedValue(model);
		await helpers.handleModel404("/contacts/c1");
		expect(t.unpersistModel).toHaveBeenCalledWith(model);
	});

	it("does not unpersist when the 404 model is absent locally", async () => {
		const t = transaction();
		t.find.mockResolvedValue(null);
		await helpers.handleModel404("/contacts/missing");
		expect(t.unpersistModel).not.toHaveBeenCalled();
	});

	it("ignores malformed 404 collection paths", async () => {
		await helpers.handleModel404("/contacts/c1/extra");
		expect(m.inTransaction).not.toHaveBeenCalled();
	});

	it("resolves the authentication plugin immediately", async () => {
		await expect(helpers.authPlugin()).resolves.toBeUndefined();
	});

	it("constructs requests with the Nylas API singleton", async () => {
		await helpers.getCollection("a1", "contacts");
		expect(m.requestInstances[0].config.api).toBe(NylasAPI);
	});
});
