// @vitest-environment node
// The pure parts of the real-app harness (e2e/): the axe-baseline gate, the
// known-errors filter, and the seed's WAL checkpoint (#13).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	compareToBaseline,
	countViolations,
	formatFailures,
	readBaseline,
	updateBaseline,
} from "../e2e/axe-baseline.mjs";
import {
	compileKnownErrors,
	loadKnownErrors,
	unexpectedErrors,
} from "../e2e/errors.mjs";
import { checkpointWal } from "../scripts/seed-fixture-account.mjs";

const violation = (id, targets, impact = "serious") => ({
	id,
	impact,
	help: `${id} help`,
	nodes: targets.map((t) => ({ target: [t] })),
});

describe("compareToBaseline", () => {
	const baseline = { "color-contrast": 2, region: 3 };

	it("passes when every rule is at its baseline", () => {
		const violations = [
			violation("color-contrast", [".a", ".b"]),
			violation("region", [".c", ".d", ".e"]),
		];
		expect(compareToBaseline(violations, baseline)).toEqual([]);
	});

	it("passes when a rule has fewer nodes than its baseline", () => {
		expect(
			compareToBaseline([violation("region", [".c"])], baseline),
		).toEqual([]);
	});

	it("fails on a rule id the baseline doesn't have, naming its nodes", () => {
		const failures = compareToBaseline(
			[violation("image-alt", ["img.logo"], "critical")],
			baseline,
		);
		expect(failures).toEqual([
			{
				rule: "image-alt",
				baseline: 0,
				actual: 1,
				impact: "critical",
				help: "image-alt help",
				targets: ["img.logo"],
			},
		]);
		expect(formatFailures("composer", failures)).toMatch(
			/^\[composer\] new rule image-alt \(1 nodes\), critical: image-alt help\n {4}img\.logo$/,
		);
	});

	it("fails on a node count above the baseline", () => {
		const failures = compareToBaseline(
			[violation("color-contrast", [".a", ".b", ".new"])],
			baseline,
		);
		expect(failures).toHaveLength(1);
		expect(failures[0]).toMatchObject({
			rule: "color-contrast",
			baseline: 2,
			actual: 3,
		});
		expect(formatFailures("default", failures)).toContain(
			"[default] color-contrast: 3 nodes, baseline 2",
		);
	});

	it("treats a window with no baseline entry as allowing nothing", () => {
		expect(compareToBaseline([violation("region", [".x"])])).toHaveLength(1);
	});
});

describe("axe baseline file", () => {
	let dir;
	afterEach(() => {
		if (dir) fs.rmSync(dir, { recursive: true, force: true });
	});

	it("counts nodes per rule and rewrites only the window it's given", () => {
		dir = fs.mkdtempSync(path.join(os.tmpdir(), "axe-baseline-"));
		const file = path.join(dir, "axe-baseline.json");
		fs.writeFileSync(file, JSON.stringify({ work: { region: 2 } }));
		updateBaseline(
			"default",
			[violation("region", [".a"]), violation("button-name", [".b", ".c"])],
			file,
		);
		expect(readBaseline(file)).toEqual({
			default: { "button-name": 2, region: 1 },
			work: { region: 2 },
		});
		expect(countViolations([])).toEqual({});
	});
});

describe("known errors", () => {
	const issue = "https://github.com/heyjawrsh/nylas-mail/issues/17";

	it("requires every entry to name its issue", () => {
		expect(() => compileKnownErrors([{ match: "boom" }])).toThrow(
			/must name the open issue/,
		);
		expect(() => compileKnownErrors([{ issue }])).toThrow(/has no "match"/);
	});

	it("filters matched errors, honouring a window list", () => {
		const known = compileKnownErrors([
			{ match: "^reading 'killed'", issue },
			{ match: "only-in-work", issue, windows: ["work"] },
		]);
		const errors = [
			{ window: "default", kind: "console.error", text: "reading 'killed'" },
			{ window: "default", kind: "pageerror", text: "only-in-work" },
			{ window: "work", kind: "pageerror", text: "only-in-work" },
			{ window: "composer", kind: "pageerror", text: "TypeError: new" },
		];
		expect(unexpectedErrors(errors, known).map((e) => e.text)).toEqual([
			"only-in-work",
			"TypeError: new",
		]);
	});

	it("keeps the committed known-errors.json valid", () => {
		expect(loadKnownErrors().length).toBeGreaterThan(0);
	});
});

describe("checkpointWal (#13)", () => {
	const noWait = () => Promise.resolve();
	const locked = () => {
		throw new Error("database table is locked");
	};

	it("truncates when nothing holds a lock", async () => {
		const db = { pragma: vi.fn(() => [{ busy: 0 }]) };
		await expect(checkpointWal(db, { sleep: noWait })).resolves.toBe(
			"truncate",
		);
		expect(db.pragma).toHaveBeenCalledWith("wal_checkpoint(TRUNCATE)");
	});

	it("retries a locked TRUNCATE with backoff, then succeeds", async () => {
		const pragma = vi
			.fn()
			.mockImplementationOnce(locked)
			.mockImplementationOnce(() => [{ busy: 1 }])
			.mockImplementation(() => [{ busy: 0 }]);
		const waits = [];
		const sleep = (ms) => {
			waits.push(ms);
			return Promise.resolve();
		};
		await expect(
			checkpointWal({ pragma }, { sleep, delayMs: 10 }),
		).resolves.toBe("truncate");
		expect(pragma).toHaveBeenCalledTimes(3);
		expect(waits).toEqual([10, 20]);
	});

	it("falls back to PASSIVE when the lock never clears", async () => {
		const pragma = vi.fn((sql) => {
			if (sql.includes("TRUNCATE")) locked();
			return [{ busy: 0 }];
		});
		await expect(
			checkpointWal({ pragma }, { sleep: noWait, attempts: 3 }),
		).resolves.toBe("passive");
		expect(pragma.mock.calls.map(([sql]) => sql)).toEqual([
			"wal_checkpoint(TRUNCATE)",
			"wal_checkpoint(TRUNCATE)",
			"wal_checkpoint(TRUNCATE)",
			"wal_checkpoint(PASSIVE)",
		]);
	});

	it("rethrows an error that isn't a lock", async () => {
		const pragma = vi.fn(() => {
			throw new Error("disk I/O error");
		});
		await expect(checkpointWal({ pragma }, { sleep: noWait })).rejects.toThrow(
			"disk I/O error",
		);
	});
});
