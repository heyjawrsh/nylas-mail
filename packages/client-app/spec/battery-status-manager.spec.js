import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	recordUserEvent: vi.fn(),
}));

vi.mock("../src/flux/actions.js", () => ({
	default: { recordUserEvent: mocks.recordUserEvent },
}));

let BatteryStatusManager;

beforeAll(async () => {
	// Importing the module activates its singleton, so provide the browser API first.
	const singletonBattery = {
		charging: false,
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
	};
	Object.defineProperty(navigator, "getBattery", {
		configurable: true,
		value: vi.fn().mockResolvedValue(singletonBattery),
	});
	const module = await import("../src/services/battery-status-manager.js");
	BatteryStatusManager = module.default.constructor;
});

describe("BatteryStatusManager", () => {
	let manager;
	let battery;

	beforeEach(() => {
		vi.clearAllMocks();
		battery = {
			charging: false,
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
		};
		Object.defineProperty(navigator, "getBattery", {
			configurable: true,
			value: vi.fn().mockResolvedValue(battery),
		});
		manager = new BatteryStatusManager();
	});

	it("starts without an attached battery", () => {
		expect(manager._battery).toBeNull();
		expect(manager.isBatteryCharging()).toBe(false);
	});

	it("activates using the browser battery API", async () => {
		await manager.activate();
		expect(navigator.getBattery).toHaveBeenCalledOnce();
		expect(manager._battery).toBe(battery);
	});

	it("subscribes to charging changes on activation", async () => {
		await manager.activate();
		expect(battery.addEventListener).toHaveBeenCalledWith(
			"chargingchange",
			manager._onChargingChange,
		);
	});

	it("does not activate twice", async () => {
		await manager.activate();
		await manager.activate();
		expect(navigator.getBattery).toHaveBeenCalledOnce();
		expect(battery.addEventListener).toHaveBeenCalledOnce();
	});

	it("reports the attached battery charging flag", async () => {
		battery.charging = true;
		await manager.activate();
		expect(manager.isBatteryCharging()).toBe(true);
	});

	it("removes its listener and battery reference on deactivation", async () => {
		await manager.activate();
		manager.deactivate();
		expect(battery.removeEventListener).toHaveBeenCalledWith(
			"chargingchange",
			manager._onChargingChange,
		);
		expect(manager._battery).toBeNull();
	});

	it("ignores deactivation before activation", () => {
		manager.deactivate();
		expect(battery.removeEventListener).not.toHaveBeenCalled();
	});

	it("retains every registered change callback", () => {
		const first = vi.fn();
		const second = vi.fn();
		manager.onChange(first);
		manager.onChange(second);
		manager._onChargingChange();
		expect(first).toHaveBeenCalledOnce();
		expect(second).toHaveBeenCalledOnce();
	});

	it("records elapsed time and the module's charging-state label", () => {
		vi.spyOn(Date, "now").mockReturnValue(5000);
		manager._lastChangeTime = 3500;
		manager._battery = { charging: true };
		manager._onChargingChange();
		// The implementation labels charging=true as "battery", despite the name.
		expect(mocks.recordUserEvent).toHaveBeenCalledWith("Battery State Changed", {
			oldState: "battery",
			oldStateDuration: 1500,
		});
		expect(manager._lastChangeTime).toBe(5000);
	});

	it("caps reported state duration at twelve hours", () => {
		const twelveHours = 12 * 60 * 60 * 1000;
		vi.spyOn(Date, "now").mockReturnValue(twelveHours + 1000);
		manager._lastChangeTime = 0;
		manager._battery = { charging: false };
		manager._onChargingChange();
		expect(mocks.recordUserEvent).toHaveBeenCalledWith("Battery State Changed", {
			oldState: "ac",
			oldStateDuration: twelveHours,
		});
	});
});
