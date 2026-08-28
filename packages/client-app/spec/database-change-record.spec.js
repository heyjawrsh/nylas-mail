import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	reviver: vi.fn((_key, value) => value),
	replacer: vi.fn((_key, value) => value),
}));
vi.mock("../src/flux/models/utils.js", () => ({
	default: {
		registeredObjectReviver: mocks.reviver,
		registeredObjectReplacer: mocks.replacer,
	},
}));

// This source is CommonJS but exposes `.default` explicitly for ESM consumers.
import DatabaseChangeRecord from "../src/flux/stores/database-change-record.js";

describe("DatabaseChangeRecord", () => {
	it("exposes type, class, and supplied objects", () => {
		const objects = [{ id: "a" }];
		const record = new DatabaseChangeRecord({ type: "persist", objectClass: "Thread", objects });
		expect(record.type).toBe("persist");
		expect(record.objectClass).toBe("Thread");
		expect(record.objects).toBe(objects);
	});

	it("hydrates serialized objects with the registered reviver", () => {
		const record = new DatabaseChangeRecord({ type: "persist", objectClass: "Thread", objectsString: '[{"id":"a"}]' });
		expect(record.objects).toEqual([{ id: "a" }]);
		expect(mocks.reviver).toHaveBeenCalled();
	});

	it("strips bodies from persisted messages", () => {
		const record = new DatabaseChangeRecord({ type: "persist", objectClass: "Message", objects: [{ draft: false, body: "large" }] });
		expect(record.objects[0].body).toBeNull();
	});

	it("retains draft message bodies", () => {
		const record = new DatabaseChangeRecord({ type: "persist", objectClass: "Message", objects: [{ draft: true, body: "editable" }] });
		expect(record.objects[0].body).toBe("editable");
	});

	it("serializes only the transport fields", () => {
		const record = new DatabaseChangeRecord({ type: "unpersist", objectClass: "Thread", objects: [{ id: "a" }] });
		expect(record.toJSON()).toEqual({ type: "unpersist", objectClass: "Thread", objectsString: '[{"id":"a"}]' });
		expect(mocks.replacer).toHaveBeenCalled();
	});

	it("reuses an existing serialized payload", () => {
		const payload = '[{"id":"a"}]';
		const record = new DatabaseChangeRecord({ type: "persist", objectClass: "Thread", objectsString: payload });
		mocks.replacer.mockClear();
		expect(record.toJSON().objectsString).toBe(payload);
		expect(mocks.replacer).not.toHaveBeenCalled();
	});
});
