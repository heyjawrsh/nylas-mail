import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	existsSync: vi.fn(),
	mkdirSync: vi.fn(),
	readdirSync: vi.fn(),
	renameSync: vi.fn(),
}));

vi.mock("node:fs", () => ({ default: mocks }));

import PackageMigrationManager from "../src/browser/package-migration-manager.js";

function makeConfig({ savedVersion, disabledPackages = [] } = {}) {
	return {
		get: vi.fn((key) => key === "core.packageMigrationVersion" ? savedVersion : disabledPackages),
		set: vi.fn(),
		pushAtKeyPath: vi.fn(),
		removeAtKeyPath: vi.fn(),
	};
}

function makeManager(options = {}) {
	const config = makeConfig(options);
	return { config, manager: new PackageMigrationManager({ config, version: options.version || "3.0.0", configDirPath: "/config" }) };
}

beforeEach(() => {
	vi.clearAllMocks();
	mocks.existsSync.mockReturnValue(false);
	mocks.readdirSync.mockReturnValue([]);
});

describe("PackageMigrationManager", () => {
	it("returns every package migration for a fresh install", () => {
		const { manager } = makeManager();
		expect(manager.getMigrationsToRun().map((migration) => migration["new-name"])).toEqual([
			"composer-markdown", "thread-snooze",
		]);
	});

	it("returns only migrations newer than the saved version", () => {
		const { manager } = makeManager({ savedVersion: "0.4.100" });
		expect(manager.getMigrationsToRun().map((migration) => migration["new-name"])).toEqual([
			"thread-snooze",
		]);
	});

	it("returns no migrations after the final migration version", () => {
		const { manager } = makeManager({ savedVersion: "2.0.1" });
		expect(manager.getMigrationsToRun()).toEqual([]);
	});

	it("does nothing when the saved version equals the application version", () => {
		const { config, manager } = makeManager({ savedVersion: "3.0.0" });
		manager.migrate();
		expect(config.set).not.toHaveBeenCalled();
		expect(mocks.existsSync).not.toHaveBeenCalled();
	});

	it("records the current version after migration", () => {
		const { config, manager } = makeManager({ savedVersion: "2.0.1", version: "3.0.0" });
		manager.migrate();
		expect(config.set).toHaveBeenCalledWith("core.packageMigrationVersion", "3.0.0");
	});

	it("disables packages whose migrations are not enabled by default", () => {
		const { config, manager } = makeManager();
		manager.migrate();
		expect(config.pushAtKeyPath.mock.calls).toEqual([
			["core.disabledPackages", "composer-markdown"],
		]);
	});

	it("enables default packages that used to be disabled", () => {
		const { config, manager } = makeManager({
			savedVersion: "0.4.204",
			disabledPackages: ["thread-snooze"],
		});
		manager.migrate();
		expect(config.removeAtKeyPath.mock.calls).toEqual([
			["core.disabledPackages", "thread-snooze"],
		]);
	});

	it("moves installed legacy packages into packages-deprecated", () => {
		mocks.existsSync.mockImplementation((target) => target === "/config/packages");
		mocks.readdirSync.mockReturnValue(["N1-Markdown-Composer", "unrelated"]);
		const { manager } = makeManager();
		manager.migrate();
		expect(mocks.mkdirSync).toHaveBeenCalledWith("/config/packages-deprecated");
		expect(mocks.renameSync).toHaveBeenCalledWith(
			"/config/packages/N1-Markdown-Composer",
			"/config/packages-deprecated/N1-Markdown-Composer",
		);
	});

	it("does not recreate an existing deprecated directory", () => {
		mocks.existsSync.mockReturnValue(true);
		mocks.readdirSync.mockReturnValue([]);
		makeManager().manager.migrate();
		expect(mocks.mkdirSync).not.toHaveBeenCalled();
	});

	it("ignores hidden and unrelated package directories", () => {
		mocks.existsSync.mockImplementation((target) => target === "/config/packages");
		mocks.readdirSync.mockReturnValue([".N1-Markdown-Composer", "unrelated"]);
		makeManager().manager.migrate();
		expect(mocks.renameSync).not.toHaveBeenCalled();
	});

	it("keeps a migrated package enabled when its old install was enabled", () => {
		mocks.existsSync.mockImplementation((target) => target === "/config/packages");
		mocks.readdirSync.mockReturnValue(["N1-Markdown-Composer"]);
		const { config, manager } = makeManager();
		manager.migrate();
		expect(config.pushAtKeyPath).not.toHaveBeenCalledWith(
			"core.disabledPackages", "composer-markdown",
		);
	});

	it("does not preserve enabled state for an old install that was disabled", () => {
		mocks.existsSync.mockImplementation((target) => target === "/config/packages");
		mocks.readdirSync.mockReturnValue(["N1-Markdown-Composer"]);
		const { config, manager } = makeManager({ disabledPackages: ["N1-Markdown-Composer"] });
		manager.migrate();
		expect(config.pushAtKeyPath).toHaveBeenCalledWith(
			"core.disabledPackages", "composer-markdown",
		);
	});
});
