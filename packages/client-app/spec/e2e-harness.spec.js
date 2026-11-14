// @vitest-environment node
// The pure parts of the real-app harness (e2e/): the axe-baseline gate, the
// known-errors filter, and the seed's WAL checkpoint (#13).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
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
		fs.writeFileSync(
			file,
			JSON.stringify({
				linux: { work: { region: 2 } },
				mac: { default: { region: 9 } },
			}),
		);
		updateBaseline(
			"default",
			[violation("region", [".a"]), violation("button-name", [".b", ".c"])],
			file,
			"linux",
		);
		expect(readBaseline(file, "linux")).toEqual({
			default: { "button-name": 2, region: 1 },
			work: { region: 2 },
		});
		// Another OS's entry is untouched.
		expect(readBaseline(file, "mac")).toEqual({ default: { region: 9 } });
		expect(readBaseline(file, "windows")).toEqual({});
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
	let dir;
	const open = [];
	const connect = (file, options) => {
		const db = new Database(file, options);
		open.push(db);
		return db;
	};
	// An app-like database: WAL mode, rows still in the WAL, writer open.
	const seeded = () => {
		dir = fs.mkdtempSync(path.join(os.tmpdir(), "nylas-wal-"));
		const file = path.join(dir, "edgehill.db");
		const app = connect(file);
		app.pragma("journal_mode = WAL");
		app.pragma("wal_autocheckpoint = 0");
		app.exec("CREATE TABLE thread (id TEXT)");
		const insert = app.prepare("INSERT INTO thread VALUES (?)");
		for (let i = 0; i < 25; i++) insert.run(`t${i}`);
		return { file, app };
	};

	afterEach(() => {
		for (const db of open.splice(0)) if (db.open) db.close();
		if (dir) fs.rmSync(dir, { recursive: true, force: true });
		dir = null;
	});

	it("folds the WAL into the main file so the file stands on its own", () => {
		const { file } = seeded();
		expect(fs.statSync(`${file}-wal`).size).toBeGreaterThan(0);
		const row = checkpointWal(file);
		expect(row.busy).toBe(0);
		expect(fs.statSync(`${file}-wal`).size).toBe(0);
		const copy = path.join(dir, "copy.db");
		fs.copyFileSync(file, copy);
		expect(connect(copy).prepare("SELECT count(*) AS n FROM thread").get().n).toBe(25);
	});

	it("reports clearly, not SQLITE_LOCKED, when a connection has a statement open", () => {
		const { file, app } = seeded();
		const rows = app.prepare("SELECT id FROM thread").iterate();
		rows.next();
		expect(() => checkpointWal(file, { timeout: 10 })).toThrow(
			/another connection still has it open/,
		);
		rows.return();
	});
});
