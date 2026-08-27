import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SerializableRegistry from "../src/registries/serializable-registry.js";
import taskRegistry from "../src/registries/task-registry.js";
import soundRegistry from "../src/registries/sound-registry.js";

class Record {
	fromJSON(data) {
		this.data = data;
		return this;
	}
}

describe("SerializableRegistry", () => {
	let registry;

	beforeEach(() => {
		registry = new SerializableRegistry();
	});

	it("starts without registrations", () => {
		expect(registry.getAllConstructors()).toEqual([]);
	});

	it("registers a lazy constructor factory", () => {
		registry.register("Record", () => Record);
		expect(registry.get("Record")).toBe(Record);
	});

	it("does not invoke a factory during registration", () => {
		const factory = vi.fn(() => Record);
		registry.register("Record", factory);
		expect(factory).not.toHaveBeenCalled();
	});

	it("invokes a factory each time get is called", () => {
		const factory = vi.fn(() => Record);
		registry.register("Record", factory);
		registry.get("Record");
		registry.get("Record");
		expect(factory).toHaveBeenCalledTimes(2);
	});

	it("calls constructor factories without a receiver", () => {
		let receiver = "unset";
		registry.register("Record", function factory() { receiver = this; return Record; });
		registry.get("Record");
		expect(receiver).toBeNull();
	});

	it("reports registered names", () => {
		registry.register("Record", () => Record);
		expect(registry.isInRegistry("Record")).toBe(true);
	});

	it("reports missing names", () => {
		expect(registry.isInRegistry("Missing")).toBe(false);
	});

	it("returns every registered constructor", () => {
		class Other {}
		registry.register("Record", () => Record);
		registry.register("Other", () => Other);
		expect(registry.getAllConstructors()).toEqual([Record, Other]);
	});

	it("replaces a registration with the same name", () => {
		class Replacement {}
		registry.register("Record", () => Record);
		registry.register("Record", () => Replacement);
		expect(registry.get("Record")).toBe(Replacement);
	});

	it("unregisters a constructor", () => {
		registry.register("Record", () => Record);
		registry.unregister("Record");
		expect(registry.isInRegistry("Record")).toBe(false);
	});

	it("deserializes an object value", () => {
		registry.register("Record", () => Record);
		expect(registry.deserialize("Record", { id: 7 })).toMatchObject({ data: { id: 7 } });
	});

	it("deserializes a JSON string", () => {
		registry.register("Record", () => Record);
		expect(registry.deserialize("Record", '{"id":8}').data).toEqual({ id: 8 });
	});

	it("creates a fresh instance for every deserialization", () => {
		registry.register("Record", () => Record);
		expect(registry.deserialize("Record", {})).not.toBe(registry.deserialize("Record", {}));
	});

	it("passes parsed data to fromJSON", () => {
		const fromJSON = vi.fn();
		class Observed { fromJSON(data) { fromJSON(data); } }
		registry.register("Observed", () => Observed);
		registry.deserialize("Observed", '{"enabled":true}');
		expect(fromJSON).toHaveBeenCalledWith({ enabled: true });
	});

	it("rejects a factory result that is not a constructor", () => {
		registry.register("Bad", () => ({ fromJSON() {} }));
		expect(() => registry.deserialize("Bad", {})).toThrow("factory must return a class constructor");
	});

	it("propagates invalid JSON errors", () => {
		registry.register("Record", () => Record);
		expect(() => registry.deserialize("Record", "not json")).toThrow(SyntaxError);
	});
});

describe("standalone registry singletons", () => {
	afterEach(() => {
		for (const name of ["spec-tone", "spec-a", "spec-b"]) {
			soundRegistry.unregister(name);
		}
		taskRegistry.unregister("SpecTask");
	});

	it("task registry exposes SerializableRegistry behavior", () => {
		const name = "SpecTask";
		taskRegistry.register(name, () => Record);
		expect(taskRegistry.deserialize(name, { ok: true }).data).toEqual({ ok: true });
	});

	it("sound registry registers a string path", () => {
		soundRegistry.register("spec-tone", "tone.mp3");
		expect(soundRegistry._sounds["spec-tone"]).toBe("tone.mp3");
		soundRegistry.unregister("spec-tone");
	});

	it("sound registry registers a map of paths", () => {
		soundRegistry.register({ "spec-a": "a.mp3", "spec-b": ["sounds", "b.mp3"] });
		expect(soundRegistry._sounds).toMatchObject({ "spec-a": "a.mp3", "spec-b": ["sounds", "b.mp3"] });
		soundRegistry.unregister(["spec-a", "spec-b"]);
	});

	it("sound registry unregisters one name", () => {
		soundRegistry.register("spec-tone", "tone.mp3");
		expect(soundRegistry.unregister("spec-tone")).toBe(true);
		expect(soundRegistry._sounds).not.toHaveProperty("spec-tone");
	});

	it("sound registry unregisters an array of names", () => {
		soundRegistry.register({ "spec-a": "a.mp3", "spec-b": "b.mp3" });
		expect(soundRegistry.unregister(["spec-a", "spec-b"])).toEqual([true, true]);
	});

	it("sound playback is inert in spec mode", () => {
		soundRegistry.register("spec-tone", "tone.mp3");
		expect(soundRegistry.playSound("spec-tone")).toBeUndefined();
	});
});
