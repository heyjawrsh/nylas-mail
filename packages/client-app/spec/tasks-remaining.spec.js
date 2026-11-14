import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	deepClone: vi.fn((value) => structuredClone(value)),
	find: vi.fn(),
	findBy: vi.fn(),
	inTransaction: vi.fn(),
	persistModel: vi.fn(),
	refreshDraftReference: vi.fn(),
	unpersistModel: vi.fn(),
	run: vi.fn(),
	api: {
		incrementRemoteChangeLock: vi.fn(),
		decrementRemoteChangeLock: vi.fn(),
		PermanentErrorCodes: [400, 403],
	},
}));

vi.mock("../src/flux/tasks/task.js", () => ({
	default: class Task {
		static Status = { Success: "success", Continue: "continue", Retry: "retry", Failed: "failed" };

		constructor() {
			this.sequentialId = null;
		}

		validateRequiredFields(fields) {
			for (const field of fields) {
				if (!this[field]) throw new Error(`Must pass ${field}`);
			}
		}
	},
}));
vi.mock("../src/flux/stores/draft-helpers.js", () => ({
	default: {
		DraftNotFoundError: class DraftNotFoundError extends Error {},
		refreshDraftReference: mocks.refreshDraftReference,
	},
}));
vi.mock("../src/flux/stores/database-store.js", () => ({
	default: {
		findBy: mocks.findBy,
		inTransaction: mocks.inTransaction,
	},
}));
vi.mock("../src/flux/stores/account-store.js", () => ({ default: {} }));
vi.mock("../src/flux/models/category.js", () => ({ default: class Category {} }));
vi.mock("../src/flux/models/message.js", () => ({ default: class Message {} }));
vi.mock("../src/flux/models/event.js", () => ({ default: class Event {} }));
vi.mock("../src/flux/models/utils.js", () => ({
	default: { deepClone: mocks.deepClone },
}));
vi.mock("../src/flux/tasks/change-folder-task.js", () => ({
	default: class ChangeFolderTask {},
}));
vi.mock("../src/flux/tasks/change-labels-task.js", () => ({
	default: class ChangeLabelsTask {},
}));
vi.mock("../src/flux/tasks/syncback-category-task.js", () => ({
	default: class SyncbackCategoryTask {},
}));
vi.mock("../src/flux/nylas-api.js", () => ({ default: mocks.api }));
// run() is async in the app, so it returns a native promise: the tasks
// can't lean on Bluebird-only methods like thenReturn or a typed catch.
vi.mock("../src/flux/nylas-api-request.js", () => ({
	default: class NylasAPIRequest {
		async run() {
			return mocks.run();
		}
	},
}));
vi.mock("../src/flux/syncback-task-api-request.js", () => ({
	default: class SyncbackTaskAPIRequest {},
}));
vi.mock("../src/flux/errors.js", () => ({
	APIError: class APIError extends Error {
		constructor(statusCode) {
			super(`API ${statusCode}`);
			this.statusCode = statusCode;
		}
	},
}));

import BaseDraftTask from "../src/flux/tasks/base-draft-task.js";
import DestroyCategoryTask from "../src/flux/tasks/destroy-category-task.js";
import DestroyDraftTask from "../src/flux/tasks/destroy-draft-task.js";
import DestroyModelTask from "../src/flux/tasks/destroy-model-task.js";
import EventRSVPTask from "../src/flux/tasks/event-rsvp-task.js";
import Event from "../src/flux/models/event.js";
import ChangeFolderTask from "../src/flux/tasks/change-folder-task.js";
import ChangeLabelsTask from "../src/flux/tasks/change-labels-task.js";
import SyncbackCategoryTask from "../src/flux/tasks/syncback-category-task.js";
import { APIError } from "../src/flux/errors.js";

beforeEach(() => {
	vi.clearAllMocks();
	mocks.inTransaction.mockImplementation((callback) => callback({
		find: mocks.find,
		persistModel: mocks.persistModel,
		unpersistModel: mocks.unpersistModel,
	}));
	mocks.persistModel.mockResolvedValue(undefined);
	mocks.unpersistModel.mockResolvedValue(undefined);
});

describe("BaseDraftTask", () => {
	it("accepts a draft client id locally", async () => {
		await expect(new BaseDraftTask("draft-1").performLocal()).resolves.toBeUndefined();
	});

	it("rejects a missing draft client id locally", async () => {
		await expect(new BaseDraftTask().performLocal()).rejects.toThrow("without a draftClientId");
	});

	it("dequeues an older task of the exact same class and draft", () => {
		const task = new BaseDraftTask("draft-1");
		task.sequentialId = 4;
		const other = new BaseDraftTask("draft-1");
		other.sequentialId = 3;
		expect(task.shouldDequeueOtherTask(other)).toBe(true);
	});

	it("does not dequeue a task for another draft", () => {
		const task = new BaseDraftTask("draft-1");
		task.sequentialId = 4;
		const other = new BaseDraftTask("draft-2");
		other.sequentialId = 3;
		expect(task.shouldDequeueOtherTask(other)).toBe(false);
	});

	it("waits for an older draft task for the same draft", () => {
		const task = new BaseDraftTask("draft-1");
		task.sequentialId = 2;
		const other = new BaseDraftTask("draft-1");
		other.sequentialId = 1;
		expect(task.isDependentOnTask(other)).toBe(true);
	});

	it("refreshes and retains its draft reference", async () => {
		const draft = { clientId: "draft-1" };
		mocks.refreshDraftReference.mockResolvedValue(draft);
		const task = new BaseDraftTask("draft-1");
		await expect(task.refreshDraftReference()).resolves.toBe(draft);
		expect(task.draft).toBe(draft);
		expect(mocks.refreshDraftReference).toHaveBeenCalledWith("draft-1");
	});
});

describe("DestroyCategoryTask", () => {
	const category = () => ({
		displayName: "Receipts",
		displayType: () => "label",
	});

	it("labels the category deletion", () => {
		expect(new DestroyCategoryTask({ category: category() }).label()).toBe("Deleting label Receipts");
	});

	it("depends on folder changes", () => {
		expect(new DestroyCategoryTask({ category: category() }).isDependentOnTask(new ChangeFolderTask())).toBe(true);
	});

	it("depends on label changes", () => {
		expect(new DestroyCategoryTask({ category: category() }).isDependentOnTask(new ChangeLabelsTask())).toBe(true);
	});

	it("depends on category syncback", () => {
		expect(new DestroyCategoryTask({ category: category() }).isDependentOnTask(new SyncbackCategoryTask())).toBe(true);
	});

	it("rejects a missing category locally", async () => {
		await expect(new DestroyCategoryTask().performLocal()).rejects.toThrow("without this.category");
	});

	it("unpersists the category in a transaction", async () => {
		const model = category();
		await new DestroyCategoryTask({ category: model }).performLocal();
		expect(mocks.inTransaction).toHaveBeenCalledOnce();
		expect(mocks.unpersistModel).toHaveBeenCalledWith(model);
	});
});

describe("DestroyDraftTask", () => {
	it("dequeues any base draft task for the same draft", () => {
		const task = new DestroyDraftTask("draft-1");
		expect(task.shouldDequeueOtherTask(new BaseDraftTask("draft-1"))).toBe(true);
	});

	it("does not dequeue a task for another draft", () => {
		const task = new DestroyDraftTask("draft-1");
		expect(task.shouldDequeueOtherTask(new BaseDraftTask("draft-2"))).toBe(false);
	});

	it("refreshes and unpersists the draft locally", async () => {
		const draft = { clientId: "draft-1" };
		mocks.refreshDraftReference.mockResolvedValue(draft);
		await new DestroyDraftTask("draft-1").performLocal();
		expect(mocks.unpersistModel).toHaveBeenCalledWith(draft);
	});

	it("treats a missing draft as already gone", async () => {
		mocks.refreshDraftReference.mockRejectedValue(new BaseDraftTask.DraftNotFoundError());
		await expect(new DestroyDraftTask("draft-1").performLocal()).resolves.toBeUndefined();
		expect(mocks.inTransaction).not.toHaveBeenCalled();
	});

	it("still rejects other local errors", async () => {
		mocks.refreshDraftReference.mockRejectedValue(new Error("disk"));
		await expect(new DestroyDraftTask("draft-1").performLocal()).rejects.toThrow("disk");
	});

	const synced = () => {
		const task = new DestroyDraftTask("draft-1");
		task.draft = { serverId: "s1", version: 2, accountId: "a1" };
		return task;
	};

	it("succeeds when the server deletes the draft", async () => {
		mocks.run.mockResolvedValue({});
		await expect(synced().performRemote()).resolves.toBe("success");
	});

	it("continues when the server already deleted the draft", async () => {
		mocks.run.mockRejectedValue(new APIError(404));
		await expect(synced().performRemote()).resolves.toBe("continue");
		expect(mocks.api.decrementRemoteChangeLock).toHaveBeenCalled();
	});

	it("retries a temporary server error", async () => {
		mocks.run.mockRejectedValue(new APIError(503));
		await expect(synced().performRemote()).resolves.toBe("retry");
	});

	it("rethrows an error that isn't from the API", async () => {
		mocks.run.mockRejectedValue(new TypeError("boom"));
		await expect(synced().performRemote()).rejects.toThrow("boom");
	});
});

describe("DestroyModelTask", () => {
	const options = { clientId: "client-1", modelName: "Widget", endpoint: "/widgets", accountId: "account-1" };

	it("dequeues an identical destroy task", () => {
		expect(new DestroyModelTask(options).shouldDequeueOtherTask(new DestroyModelTask(options))).toBe(true);
	});

	it("does not dequeue a destroy task for another client", () => {
		const other = new DestroyModelTask({ ...options, clientId: "client-2" });
		expect(new DestroyModelTask(options).shouldDequeueOtherTask(other)).toBe(false);
	});

	it("requires a client id for its local operation", () => {
		const task = new DestroyModelTask({ ...options, clientId: null });
		expect(() => task.performLocal()).toThrow("Must pass clientId");
	});

	it("rejects a model name that does not resolve to a class", () => {
		const task = new DestroyModelTask(options);
		task.getModelConstructor = () => undefined;
		expect(() => task.performLocal()).toThrow("Couldn't find the class");
	});

	it("rejects when the requested model cannot be found", async () => {
		class Widget {}
		mocks.findBy.mockResolvedValue(undefined);
		const task = new DestroyModelTask(options);
		task.getModelConstructor = () => Widget;
		await expect(task.performLocal()).rejects.toThrow("Couldn't find the model");
	});

	it("clones and unpersists the located model", async () => {
		class Widget {}
		const oldModel = { clientId: "client-1" };
		const model = { serverId: "server-1", clone: vi.fn(() => oldModel) };
		mocks.findBy.mockResolvedValue(model);
		const task = new DestroyModelTask(options);
		task.getModelConstructor = () => Widget;
		await task.performLocal();
		expect(mocks.findBy).toHaveBeenCalledWith(Widget, { clientId: "client-1" });
		expect(task.serverId).toBe("server-1");
		expect(task.oldModel).toBe(oldModel);
		expect(mocks.unpersistModel).toHaveBeenCalledWith(model);
	});
});

describe("EventRSVPTask", () => {
	it("updates only the matching participant and persists the event", async () => {
		const event = { id: "event-1", participants: [
			{ email: "a@example.com", status: "noreply" },
			{ email: "b@example.com", status: "yes" },
		] };
		mocks.find.mockResolvedValue(event);
		await new EventRSVPTask(event, "a@example.com", "maybe").performLocal();
		expect(mocks.find).toHaveBeenCalledWith(Event, "event-1");
		expect(event.participants.map((p) => p.status)).toEqual(["maybe", "yes"]);
		expect(mocks.persistModel).toHaveBeenCalledWith(event);
	});

	it("uses the supplied event when the transaction lookup misses", async () => {
		const event = { id: "event-1", participants: [{ email: "a@example.com", status: "no" }] };
		mocks.find.mockResolvedValue(null);
		const task = new EventRSVPTask(event, "a@example.com", "yes");
		await task.performLocal();
		expect(task.event).toBe(event);
		expect(event.participants[0].status).toBe("yes");
	});

	it("captures an independent participant snapshot before mutation", async () => {
		const event = { id: "event-1", participants: [{ email: "a@example.com", status: "no" }] };
		mocks.find.mockResolvedValue(event);
		const task = new EventRSVPTask(event, "a@example.com", "yes");
		await task.performLocal();
		expect(task._previousParticipantsState).toEqual([{ email: "a@example.com", status: "no" }]);
		expect(task._previousParticipantsState).not.toBe(event.participants);
	});

	it("succeeds when the server takes the RSVP", async () => {
		mocks.run.mockResolvedValue({});
		const task = new EventRSVPTask({ id: "event-1", accountId: "a1", participants: [] }, "a@example.com", "yes");
		await expect(task.performRemote()).resolves.toBe("success");
	});

	it("restores the participants and fails on an API error", async () => {
		mocks.run.mockRejectedValue(new APIError(400));
		const before = [{ email: "a@example.com", status: "no" }];
		const event = { id: "event-1", accountId: "a1", participants: [{ email: "a@example.com", status: "yes" }] };
		const task = new EventRSVPTask(event, "a@example.com", "yes");
		task._previousParticipantsState = before;
		await expect(task.performRemote()).resolves.toBe("failed");
		expect(event.participants).toBe(before);
		expect(mocks.persistModel).toHaveBeenCalledWith(event);
	});

	it("leaves all participants unchanged when the email is absent", async () => {
		const event = { id: "event-1", participants: [{ email: "a@example.com", status: "no" }] };
		mocks.find.mockResolvedValue(event);
		await new EventRSVPTask(event, "missing@example.com", "yes").performLocal();
		expect(event.participants[0].status).toBe("no");
	});
});
