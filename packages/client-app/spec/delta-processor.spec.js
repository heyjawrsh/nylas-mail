import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => {
	if (!Promise.map) Promise.map = (items, fn) => Promise.all(items.map(fn));
	if (!Promise.props) {
		Promise.props = (object) =>
			Promise.all(
				Object.entries(object).map(async ([key, value]) => [key, await value]),
			).then((entries) => Object.fromEntries(entries));
	}
	return {
		didReceiveSyncbackRequestDeltas: vi.fn(),
		handleModelResponse: vi.fn(async (jsons) => jsons),
		inTransaction: vi.fn(),
		longPollProcessedDeltas: vi.fn(),
		longPollReceivedRawDeltas: vi.fn(),
		onNewMailDeltas: vi.fn(),
		recordUserEvent: vi.fn(),
		reportError: vi.fn(),
		updateAccount: vi.fn(),
	};
});

vi.mock("underscore", () => {
	const underscore = {
		groupBy: (items, key) => items.reduce((result, item) => {
			(result[item[key]] ||= []).push(item);
			return result;
		}, {}),
		mapObject: (object, iteratee) => Object.fromEntries(
			Object.entries(object).map(([key, value]) => [key, iteratee(value, key)]),
		),
		values: (object) => Object.values(object || {}),
	};
	return { default: underscore, ...underscore };
});
vi.mock("../src/flux/actions.js", () => ({
	default: {
		didReceiveSyncbackRequestDeltas: m.didReceiveSyncbackRequestDeltas,
		longPollProcessedDeltas: m.longPollProcessedDeltas,
		longPollReceivedRawDeltas: m.longPollReceivedRawDeltas,
		onNewMailDeltas: m.onNewMailDeltas,
		recordUserEvent: m.recordUserEvent,
		updateAccount: m.updateAccount,
	},
}));
vi.mock("../src/flux/models/thread.js", () => ({
	default: class Thread {
		constructor(attributes = {}) { Object.assign(this, attributes); }
	},
}));
vi.mock("../src/flux/models/message.js", () => ({
	default: class Message {
		constructor(attributes = {}) { Object.assign(this, attributes); }
	},
}));
vi.mock("../src/flux/stores/database-store.js", () => ({
	default: { inTransaction: m.inTransaction },
}));
vi.mock("../src/flux/nylas-api-helpers.js", () => ({
	default: { apiObjectToClassMap: {}, handleModelResponse: m.handleModelResponse },
	apiObjectToClassMap: {},
	handleModelResponse: m.handleModelResponse,
}));

globalThis.NylasEnv = { reportError: m.reportError };

const { default: DeltaProcessor } = await import("../src/services/delta-processor.js");
const { default: Thread } = await import("../src/flux/models/thread.js");
const { default: Message } = await import("../src/flux/models/message.js");
const NylasAPIHelpers = await import("../src/flux/nylas-api-helpers.js");

const delta = (event, object, id, overrides = {}) => ({
	event, object, objectId: id, attributes: { id, object, ...overrides },
});

function resetMocks() {
	vi.restoreAllMocks();
	vi.clearAllMocks();
	m.handleModelResponse.mockImplementation(async (jsons) => jsons);
}

describe("DeltaProcessor delta preparation", () => {
	beforeEach(resetMocks);

	it("records its activation time", () => {
		expect(DeltaProcessor.activationTime).toEqual(expect.any(Number));
	});

	it("returns the original delta array when decorating", () => {
		const deltas = [delta("create", "message", "m1")];
		expect(DeltaProcessor._decorateDeltas(deltas)).toBe(deltas);
	});

	it("adds a back-reference from attributes to its delta", () => {
		const item = delta("create", "message", "m1");
		DeltaProcessor._decorateDeltas([item]);
		expect(item.attributes._delta).toBe(item);
	});

	it("keeps the delta back-reference non-enumerable", () => {
		const item = delta("create", "message", "m1");
		DeltaProcessor._decorateDeltas([item]);
		expect(Object.keys(item.attributes)).not.toContain("_delta");
	});

	it("ignores deltas without attributes while decorating", () => {
		const item = { event: "delete", object: "message", objectId: "m1" };
		expect(() => DeltaProcessor._decorateDeltas([item])).not.toThrow();
	});

	it("separates metadata, account, and model deltas", () => {
		const metadata = delta("create", "metadata", "x");
		const account = delta("modify", "account", "a");
		const model = delta("create", "message", "m");
		expect(DeltaProcessor._extractDeltaTypes([metadata, account, model])).toEqual({
			modelDeltas: [model], metadataDeltas: [metadata], accountDeltas: [account],
		});
	});
});

describe("DeltaProcessor clustering and notifications", () => {
	beforeEach(resetMocks);

	it("clusters creates by object type and id", () => {
		const item = delta("create", "message", "m1", { subject: "Hi" });
		expect(DeltaProcessor._clusterDeltas([item]).create.message.m1).toBe(item.attributes);
	});

	it("deduplicates repeated creates using the last attributes", () => {
		const first = delta("create", "message", "m1", { subject: "First" });
		const last = delta("create", "message", "m1", { subject: "Last" });
		expect(DeltaProcessor._clusterDeltas([first, last]).create.message.m1.subject).toBe("Last");
	});

	it("clusters modifies separately from creates", () => {
		const created = delta("create", "thread", "t1");
		const modified = delta("modify", "thread", "t1", { unread: true });
		const result = DeltaProcessor._clusterDeltas([created, modified]);
		expect([result.create.thread.t1, result.modify.thread.t1]).toEqual([created.attributes, modified.attributes]);
	});

	it("retains delete deltas in arrival order", () => {
		const first = delta("delete", "message", "m1");
		const second = delta("delete", "thread", "t1");
		expect(DeltaProcessor._clusterDeltas([first, second]).destroy).toEqual([first, second]);
	});

	it("updates account sync state from modify deltas", () => {
		DeltaProcessor._handleAccountDeltas([delta("modify", "account", "a1", { account_id: "a1", sync_state: "running" })]);
		expect(m.updateAccount).toHaveBeenCalledWith("a1", { syncState: "running" });
	});

	it("records a user event for an errored account sync", () => {
		DeltaProcessor._handleAccountDeltas([delta("modify", "account", "a1", { account_id: "a1", sync_state: "invalid" })]);
		expect(m.recordUserEvent).toHaveBeenCalledWith("Account Sync Errored", { accountId: "a1", syncState: "invalid" });
	});

	it("does not record an error while account sync is running", () => {
		DeltaProcessor._handleAccountDeltas([delta("modify", "account", "a1", { account_id: "a1", sync_state: "running" })]);
		expect(m.recordUserEvent).not.toHaveBeenCalled();
	});

	it("ignores account creates", () => {
		DeltaProcessor._handleAccountDeltas([delta("create", "account", "a1", { account_id: "a1" })]);
		expect(m.updateAccount).not.toHaveBeenCalled();
	});

	it("combines created and updated syncback requests", () => {
		const created = { id: "s1" }; const updated = { id: "s2" };
		DeltaProcessor._notifyOfSyncbackRequestDeltas({ created: { syncbackRequest: [created] }, updated: { syncbackRequest: [updated] } });
		expect(m.didReceiveSyncbackRequestDeltas).toHaveBeenCalledWith([created, updated]);
	});

	it("does not notify for an empty syncback request result", () => {
		DeltaProcessor._notifyOfSyncbackRequestDeltas({ created: {}, updated: {} });
		expect(m.didReceiveSyncbackRequestDeltas).not.toHaveBeenCalled();
	});
});

describe("DeltaProcessor model persistence", () => {
	beforeEach(resetMocks);

	it("sends deduplicated creates to the model response handler", async () => {
		await DeltaProcessor._saveModels([delta("create", "message", "m1"), delta("create", "message", "m1", { subject: "Latest" })]);
		expect(m.handleModelResponse).toHaveBeenCalledWith([expect.objectContaining({ id: "m1", subject: "Latest" })]);
	});

	it("returns created models grouped by API object name", async () => {
		const result = await DeltaProcessor._saveModels([delta("create", "thread", "t1")]);
		expect(result.created.thread).toEqual([expect.objectContaining({ id: "t1" })]);
	});

	it("returns updated models grouped by API object name", async () => {
		const result = await DeltaProcessor._saveModels([delta("modify", "message", "m1")]);
		expect(result.updated.message).toEqual([expect.objectContaining({ id: "m1" })]);
	});

	it("processes every destroy delta", async () => {
		const destroy = vi.spyOn(DeltaProcessor, "_handleDestroyDelta").mockResolvedValue(undefined);
		await DeltaProcessor._saveModels([delta("delete", "message", "m1"), delta("delete", "thread", "t1")]);
		expect(destroy).toHaveBeenCalledTimes(2);
	});

	it("ignores destroy deltas with unknown object classes", async () => {
		await expect(DeltaProcessor._handleDestroyDelta(delta("delete", "mystery", "x"))).resolves.toBeUndefined();
		expect(m.inTransaction).not.toHaveBeenCalled();
	});

	it("unpersists a model found for a destroy delta", async () => {
		class Contact {}
		NylasAPIHelpers.apiObjectToClassMap.contact = Contact;
		const model = { id: "c1" };
		const t = { find: vi.fn().mockResolvedValue(model), unpersistModel: vi.fn().mockResolvedValue(undefined) };
		m.inTransaction.mockImplementation((fn) => fn(t));
		await DeltaProcessor._handleDestroyDelta(delta("delete", "contact", "c1"));
		expect(t.unpersistModel).toHaveBeenCalledWith(model);
	});

	it("does not unpersist when a destroyed model is absent", async () => {
		class Contact {}
		NylasAPIHelpers.apiObjectToClassMap.contact = Contact;
		const t = { find: vi.fn().mockResolvedValue(null), unpersistModel: vi.fn() };
		m.inTransaction.mockImplementation((fn) => fn(t));
		await DeltaProcessor._handleDestroyDelta(delta("delete", "contact", "missing"));
		expect(t.unpersistModel).not.toHaveBeenCalled();
	});
});

describe("DeltaProcessor metadata models", () => {
	beforeEach(resetMocks);

	it("maps existing ordinary models by id", async () => {
		class Contact {}
		const existing = { id: "c1" };
		const t = { findAll: vi.fn().mockResolvedValue([existing]), persistModels: vi.fn() };
		await expect(DeltaProcessor._findOrCreateModelsForMetadata(t, Contact, ["c1"])).resolves.toEqual({ c1: existing });
	});

	it("creates and persists ghost models for missing ordinary objects", async () => {
		class Contact { constructor(attributes) { Object.assign(this, attributes); } }
		const t = { findAll: vi.fn().mockResolvedValue([]), persistModels: vi.fn().mockResolvedValue(undefined) };
		const result = await DeltaProcessor._findOrCreateModelsForMetadata(t, Contact, ["c1"]);
		expect(t.persistModels).toHaveBeenCalledWith([expect.objectContaining({ serverId: "c1" })]);
		expect(result.c1).toBeInstanceOf(Contact);
	});

	it("resolves remote thread ids through their messages", async () => {
		const message = Object.assign(new Message(), { id: "m1", threadId: "local-t1" });
		const thread = Object.assign(new Thread(), { id: "local-t1" });
		const t = { findAll: vi.fn().mockResolvedValueOnce([message]).mockResolvedValueOnce([thread]), persistModels: vi.fn() };
		await expect(DeltaProcessor._findOrCreateThreadsForMetadata(t, ["t:m1"])).resolves.toEqual({ "t:m1": thread });
	});

	it("creates linked ghost threads and messages for missing remote threads", async () => {
		const t = { findAll: vi.fn().mockResolvedValue([]), persistModels: vi.fn().mockResolvedValue(undefined) };
		const result = await DeltaProcessor._findOrCreateThreadsForMetadata(t, ["t:m2"]);
		expect(result["t:m2"]).toMatchObject({ serverId: "t:m2", categories: [] });
		expect(t.persistModels.mock.calls[1][0][0]).toMatchObject({ serverId: "m2", threadId: "t:m2" });
	});

	it("uses the special thread resolver for thread metadata", async () => {
		const resolver = vi.spyOn(DeltaProcessor, "_findOrCreateThreadsForMetadata").mockResolvedValue({});
		await DeltaProcessor._findOrCreateModelsForMetadata({}, Thread, ["t:m1"]);
		expect(resolver).toHaveBeenCalledWith({}, ["t:m1"]);
	});

	it("keeps the last metadata delta for an object and sets its version", async () => {
		class Contact {}
		NylasAPIHelpers.apiObjectToClassMap.contact = Contact;
		const localMetadata = {};
		const model = { applyPluginMetadata: vi.fn(function apply() { return this; }), metadataObjectForPluginId: vi.fn(() => localMetadata) };
		const t = { persistModels: vi.fn().mockResolvedValue(undefined) };
		m.inTransaction.mockImplementation((fn) => fn(t));
		vi.spyOn(DeltaProcessor, "_findOrCreateModelsForMetadata").mockResolvedValue({ c1: model });
		await DeltaProcessor._saveMetadata([
			delta("create", "metadata", "one", { object_id: "c1", object_type: "contact", plugin_id: "p", value: { old: true }, version: 1 }),
			delta("modify", "metadata", "two", { object_id: "c1", object_type: "contact", plugin_id: "p", value: { fresh: true }, version: 2 }),
		]);
		expect(model.applyPluginMetadata).toHaveBeenCalledWith("p", { fresh: true });
		expect(localMetadata.version).toBe(2);
	});

	it("ignores metadata delete deltas", async () => {
		await DeltaProcessor._saveMetadata([delta("delete", "metadata", "x", { object_id: "c1", object_type: "contact" })]);
		expect(m.inTransaction).not.toHaveBeenCalled();
	});
});

describe("DeltaProcessor mail notification and process flow", () => {
	beforeEach(resetMocks);

	it("notifies for a new unread message not sent by the user", async () => {
		DeltaProcessor.activationTime = 100;
		const message = { unread: true, date: new Date(100), isFromMe: () => false };
		const created = { message: [message] };
		await DeltaProcessor._notifyOfNewMessages(created);
		expect(m.onNewMailDeltas).toHaveBeenCalledWith(created);
	});

	it("does not notify for an old unread message", async () => {
		DeltaProcessor.activationTime = 101;
		await DeltaProcessor._notifyOfNewMessages({ message: [{ unread: true, date: new Date(100), isFromMe: () => false }] });
		expect(m.onNewMailDeltas).not.toHaveBeenCalled();
	});

	it("does not notify for a read message", async () => {
		DeltaProcessor.activationTime = 100;
		await DeltaProcessor._notifyOfNewMessages({ message: [{ unread: false, date: new Date(100), isFromMe: () => false }] });
		expect(m.onNewMailDeltas).not.toHaveBeenCalled();
	});

	it("does not notify for a message sent by the current user", async () => {
		DeltaProcessor.activationTime = 100;
		await DeltaProcessor._notifyOfNewMessages({ message: [{ unread: true, date: new Date(100), isFromMe: () => true }] });
		expect(m.onNewMailDeltas).not.toHaveBeenCalled();
	});

	it("announces raw n1Cloud deltas before processing", async () => {
		const item = delta("create", "message", "m1");
		vi.spyOn(DeltaProcessor, "_saveModels").mockResolvedValue({ created: {}, updated: {} });
		await DeltaProcessor.process([item], { source: "n1Cloud" });
		expect(m.longPollReceivedRawDeltas).toHaveBeenCalledWith([item]);
	});

	it("does not announce raw deltas from other sources", async () => {
		vi.spyOn(DeltaProcessor, "_saveModels").mockResolvedValue({ created: {}, updated: {} });
		await DeltaProcessor.process([], { source: "localSync" });
		expect(m.longPollReceivedRawDeltas).not.toHaveBeenCalled();
	});

	it("always marks a delta batch processed after success", async () => {
		vi.spyOn(DeltaProcessor, "_saveModels").mockResolvedValue({ created: {}, updated: {} });
		await DeltaProcessor.process();
		expect(m.longPollProcessedDeltas).toHaveBeenCalledOnce();
	});

	it("reports unparseable or otherwise failed delta processing", async () => {
		const error = new Error("unparseable delta");
		vi.spyOn(DeltaProcessor, "_decorateDeltas").mockRejectedValue(error);
		vi.spyOn(console, "error").mockImplementation(() => {});
		await DeltaProcessor.process([{ malformed: true }]);
		expect(m.reportError).toHaveBeenCalledWith(error);
	});

	it("marks a failed delta batch processed", async () => {
		vi.spyOn(DeltaProcessor, "_decorateDeltas").mockRejectedValue(new Error("bad delta"));
		vi.spyOn(console, "error").mockImplementation(() => {});
		await DeltaProcessor.process([]);
		expect(m.longPollProcessedDeltas).toHaveBeenCalledOnce();
	});
});
