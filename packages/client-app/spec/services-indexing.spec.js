import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	createSearchIndex: vi.fn(),
	dropSearchIndex: vi.fn(),
	findAll: vi.fn(),
	indexModel: vi.fn(),
	listen: vi.fn(),
	unindexModel: vi.fn(),
}));

vi.mock("../src/flux/stores/database-store.js", () => ({
	default: mocks,
}));

vi.mock("nylas-exports", () => ({
	DatabaseStore: { findAll: mocks.findAll },
}));

import ModelSearchIndexer from "../src/services/model-search-indexer.js";
import searchIndexScheduler from "../src/services/search-index-scheduler.js";

class FixtureModel {
	constructor(values = {}) {
		Object.assign(this, values);
	}

	static naturalSortOrder() {
		return "receivedAt DESC";
	}

	static sortOrderAttribute() {
		return FixtureModel.attributes.receivedAt;
	}
}

FixtureModel.attributes = {
	isSearchIndexed: {
		equal: vi.fn((value) => ({ field: "isSearchIndexed", op: "=", value })),
	},
	receivedAt: {
		modelKey: "receivedAt",
		greaterThan: vi.fn((value) => ({ field: "receivedAt", op: ">", value })),
		lessThanOrEqualTo: vi.fn((value) => ({ field: "receivedAt", op: "<=", value })),
	},
};

const query = (result = []) => {
	const q = {
		background: vi.fn(() => Promise.resolve(result)),
		limit: vi.fn(() => q),
		offset: vi.fn(() => q),
		order: vi.fn(() => q),
		silenceQueryPlanDebugOutput: vi.fn(() => q),
		where: vi.fn(() => q),
		then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
	};
	return q;
};

class FixtureIndexer extends ModelSearchIndexer {
	get MaxIndexSize() { return 25; }
	get ConfigKey() { return "fixture-index-version"; }
	get IndexVersion() { return 3; }
	get ModelClass() { return FixtureModel; }
	getIndexDataForModel(model) { return { content: [model.subject, model.body] }; }
}

describe("ModelSearchIndexer", () => {
	let indexer;

	beforeEach(() => {
		vi.clearAllMocks();
		NylasEnv.config.get.mockReset();
		NylasEnv.config.set.mockClear();
		mocks.createSearchIndex.mockResolvedValue();
		mocks.dropSearchIndex.mockResolvedValue();
		mocks.indexModel.mockResolvedValue();
		mocks.unindexModel.mockResolvedValue();
		indexer = new FixtureIndexer();
	});

	it("requires subclasses to provide index configuration", () => {
		const base = new ModelSearchIndexer();
		expect(() => base.MaxIndexSize).toThrow("Override me");
		expect(() => base.ConfigKey).toThrow("Override me");
		expect(() => base.IndexVersion).toThrow("Override me");
		expect(() => base.ModelClass).toThrow("Override me");
		expect(() => base.getIndexDataForModel()).toThrow("Override me");
	});

	it("registers its model and starts initialization", () => {
		indexer.indexer = {
			registerSearchableModel: vi.fn(),
			unregisterSearchableModel: vi.fn(),
		};
		indexer._initializeIndex = vi.fn();
		mocks.listen.mockReturnValue(vi.fn());
		indexer.activate();
		expect(indexer.indexer.registerSearchableModel).toHaveBeenCalledWith(expect.objectContaining({
			modelClass: FixtureModel,
			indexSize: 25,
		}));
		expect(indexer._initializeIndex).toHaveBeenCalledOnce();
	});

	it("deactivates both database and scheduler subscriptions", () => {
		const stopListening = vi.fn();
		indexer.indexer = { registerSearchableModel: vi.fn(), unregisterSearchableModel: vi.fn() };
		indexer._initializeIndex = vi.fn();
		mocks.listen.mockReturnValue(stopListening);
		indexer.activate();
		indexer.deactivate();
		expect(stopListening).toHaveBeenCalledOnce();
		expect(indexer.indexer.unregisterSearchableModel).toHaveBeenCalledWith(FixtureModel);
	});

	it("recreates an index whose configured version is stale", async () => {
		NylasEnv.config.get.mockReturnValue(2);
		indexer._buildIndex = vi.fn().mockResolvedValue();
		await indexer._initializeIndex();
		expect(mocks.dropSearchIndex).toHaveBeenCalledWith(FixtureModel);
		expect(mocks.createSearchIndex).toHaveBeenCalledWith(FixtureModel);
		expect(indexer._buildIndex).toHaveBeenCalledOnce();
	});

	it("leaves a current index intact", async () => {
		NylasEnv.config.get.mockReturnValue(3);
		await indexer._initializeIndex();
		expect(mocks.dropSearchIndex).not.toHaveBeenCalled();
		expect(mocks.createSearchIndex).not.toHaveBeenCalled();
	});

	it("marks an empty index build complete", async () => {
		const q = query([]);
		mocks.findAll.mockReturnValue(q);
		await indexer._buildIndex();
		expect(q.limit).toHaveBeenCalledWith(1000);
		expect(q.offset).toHaveBeenCalledWith(0);
		expect(NylasEnv.config.set).toHaveBeenCalledWith("fixture-index-version", 3);
	});

	it("indexes fixture model content", () => {
		const model = new FixtureModel({ subject: "Launch", body: "Friday" });
		indexer._indexModel(model);
		expect(mocks.indexModel).toHaveBeenCalledWith(model, { content: ["Launch", "Friday"] });
	});

	it("unindexes a fixture model", () => {
		const model = new FixtureModel({ id: "fixture-1" });
		indexer._unindexModel(model);
		expect(mocks.unindexModel).toHaveBeenCalledWith(model);
	});

	it("ignores database changes for another model class", () => {
		indexer.indexer = { notifyHasIndexingToDo: vi.fn() };
		indexer._onDataChanged({ objectClass: "Thread", type: "persist", objects: [{}] });
		expect(indexer.indexer.notifyHasIndexingToDo).not.toHaveBeenCalled();
	});

	it("schedules indexing after fixture models persist", () => {
		indexer.indexer = { notifyHasIndexingToDo: vi.fn() };
		indexer._onDataChanged({ objectClass: "FixtureModel", type: "persist", objects: [{}, {}] });
		expect(indexer.indexer.notifyHasIndexingToDo).toHaveBeenCalledTimes(2);
	});

	it("unindexes fixture models after non-persist changes", () => {
		const model = new FixtureModel({ id: "gone" });
		indexer._unindexModel = vi.fn();
		indexer._onDataChanged({ objectClass: "FixtureModel", type: "unpersist", objects: [model] });
		expect(indexer._unindexModel).toHaveBeenCalledWith(model);
	});
});

describe("SearchIndexScheduler", () => {
	let scheduler;

	beforeEach(() => {
		vi.clearAllMocks();
		scheduler = new searchIndexScheduler.constructor();
	});

	it("registers and unregisters searchable fixture models", () => {
		scheduler.registerSearchableModel({ modelClass: FixtureModel, indexSize: 25, indexCallback: vi.fn(), unindexCallback: vi.fn() });
		expect(scheduler._searchableModels.FixtureModel.indexSize).toBe(25);
		scheduler.unregisterSearchableModel(FixtureModel);
		expect(scheduler._searchableModels.FixtureModel).toBeUndefined();
	});

	it("queries the first model beyond the configured index size", async () => {
		const cutoff = new FixtureModel({ receivedAt: 50 });
		const q = query([cutoff]);
		mocks.findAll.mockReturnValue(q);
		await expect(scheduler._getIndexCutoff(FixtureModel, 25)).resolves.toBe(cutoff);
		expect(q.offset).toHaveBeenCalledWith(25);
		expect(q.limit).toHaveBeenCalledWith(1);
		expect(q.order).toHaveBeenCalledWith("receivedAt DESC");
	});

	it("matches unindexed fixtures newer than the cutoff", () => {
		const q = query();
		mocks.findAll.mockReturnValue(q);
		scheduler._getNewUnindexed(FixtureModel, 25, { receivedAt: 50 });
		expect(q.where).toHaveBeenCalledWith([
			{ field: "isSearchIndexed", op: "=", value: false },
			{ field: "receivedAt", op: ">", value: 50 },
		]);
		expect(q.limit).toHaveBeenCalledWith(10);
	});

	it("matches every unindexed fixture when no cutoff exists", () => {
		const q = query();
		mocks.findAll.mockReturnValue(q);
		scheduler._getNewUnindexed(FixtureModel, 25);
		expect(q.where).toHaveBeenCalledWith([
			{ field: "isSearchIndexed", op: "=", value: false },
		]);
	});

	it("does not query old indexed fixtures before reaching the size limit", async () => {
		await expect(scheduler._getOldIndexed(FixtureModel)).resolves.toEqual([]);
		expect(mocks.findAll).not.toHaveBeenCalled();
	});

	it("matches indexed fixtures at or older than the cutoff", () => {
		const q = query();
		mocks.findAll.mockReturnValue(q);
		scheduler._getOldIndexed(FixtureModel, { receivedAt: 50 });
		expect(q.where).toHaveBeenCalledWith([
			{ field: "isSearchIndexed", op: "=", value: true },
			{ field: "receivedAt", op: "<=", value: 50 },
		]);
	});

	it("invokes the callbacks associated with fixture constructors", async () => {
		const indexCallback = vi.fn();
		const unindexCallback = vi.fn();
		scheduler.registerSearchableModel({ modelClass: FixtureModel, indexSize: 25, indexCallback, unindexCallback });
		const first = new FixtureModel({ id: "one" });
		const second = new FixtureModel({ id: "two" });
		await scheduler._indexItems([first]);
		await scheduler._unindexItems([second]);
		expect(indexCallback).toHaveBeenCalledWith(first);
		expect(unindexCallback).toHaveBeenCalledWith(second);
	});

	it("uses the minimum timeout before a measured run", () => {
		expect(scheduler._computeNextTimeout()).toBe(1000);
	});

	it("scales timeout to reserve most CPU time", () => {
		scheduler._lastTimeStart = new Date(1000);
		scheduler._lastTimeStop = new Date(1100);
		expect(scheduler._computeNextTimeout()).toBe(2000);
	});

	it("caps long computed timeouts at five minutes", () => {
		scheduler._lastTimeStart = new Date(0);
		scheduler._lastTimeStop = new Date(60_000);
		expect(scheduler._computeNextTimeout()).toBe(300_000);
	});

	it("coalesces repeated indexing notifications", () => {
		scheduler._scheduleRun = vi.fn();
		scheduler.notifyHasIndexingToDo();
		scheduler.notifyHasIndexingToDo();
		expect(scheduler._scheduleRun).toHaveBeenCalledOnce();
	});

	it("stops running when the index diff is empty", async () => {
		scheduler._hasIndexingToDo = true;
		scheduler._getIndexDiff = vi.fn().mockResolvedValue({ toIndex: [], toUnindex: [] });
		await scheduler.run();
		expect(scheduler._hasIndexingToDo).toBe(false);
	});

	it("processes a diff and schedules the next chunk", async () => {
		const fresh = new FixtureModel({ id: "fresh" });
		const old = new FixtureModel({ id: "old" });
		scheduler._hasIndexingToDo = true;
		scheduler._getIndexDiff = vi.fn().mockResolvedValue({ toIndex: [fresh], toUnindex: [old] });
		scheduler._indexItems = vi.fn().mockResolvedValue();
		scheduler._unindexItems = vi.fn().mockResolvedValue();
		scheduler._scheduleRun = vi.fn();
		await scheduler.run();
		expect(scheduler._indexItems).toHaveBeenCalledWith([fresh]);
		expect(scheduler._unindexItems).toHaveBeenCalledWith([old]);
		expect(scheduler._scheduleRun).toHaveBeenCalledOnce();
	});
});
