import { describe, expect, it } from "vitest";
import { jsonSchema, jsonStringify } from "../src/serialization";
describe("serialization", () => {
	it("formats JSON and provides known schemas", () => {
		expect(jsonStringify({ ok: true })).toBe('{\n  "ok": true\n}');
		expect(jsonSchema("Metadata")).toBeTruthy();
		expect(jsonSchema("Error")).toBeTruthy();
		expect(jsonSchema("Unknown")).toBeNull();
	});
});
