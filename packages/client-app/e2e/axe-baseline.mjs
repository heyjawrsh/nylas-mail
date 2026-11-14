// The axe gate. axe-baseline.json records today's violations, keyed by OS
// (the same names as reference/<os>/), then window type, then rule id, then
// node count. Each OS has its own entry because the app's chrome differs:
// macOS draws its own window-control buttons, Linux uses the system frame.
// A window fails on a rule id that isn't in its baseline or a node count
// above it; fewer nodes pass (the baseline can then be shrunk). Only
// `--update-axe-baseline` rewrites the file, and only this OS's entry.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const axeBaselinePath = path.join(here, "axe-baseline.json");
export const OS_NAME = { linux: "linux", darwin: "mac", win32: "windows" }[
	process.platform
];

const sortKeys = (obj) =>
	Object.fromEntries(
		Object.entries(obj).sort(([a], [b]) => a.localeCompare(b)),
	);

// { ruleId: nodeCount } for one axe result.
export function countViolations(violations) {
	const counts = {};
	for (const v of violations) counts[v.id] = v.nodes.length;
	return Object.fromEntries(Object.entries(counts).sort());
}

// Compares one window's axe violations to its baseline entry. Returns a list
// of failures: { rule, baseline, actual, impact, help, targets }.
export function compareToBaseline(violations, baseline = {}) {
	const failures = [];
	for (const v of violations) {
		const allowed = baseline[v.id] ?? 0;
		if (v.nodes.length > allowed) {
			failures.push({
				rule: v.id,
				baseline: allowed,
				actual: v.nodes.length,
				impact: v.impact,
				help: v.help,
				// Every node is printed; the new ones are among them, since axe
				// doesn't say which nodes the baseline already had.
				targets: v.nodes.map((n) => n.target.join(" ")),
			});
		}
	}
	return failures;
}

export function formatFailures(windowType, failures) {
	return failures
		.map((f) => {
			const what =
				f.baseline === 0
					? `new rule ${f.rule} (${f.actual} nodes)`
					: `${f.rule}: ${f.actual} nodes, baseline ${f.baseline}`;
			const nodes = f.targets.map((t) => `    ${t}`).join("\n");
			return `[${windowType}] ${what}, ${f.impact}: ${f.help}\n${nodes}`;
		})
		.join("\n");
}

const readAll = (file) =>
	existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};

// One OS's baseline: { windowType: { ruleId: nodeCount } }.
export function readBaseline(file = axeBaselinePath, os = OS_NAME) {
	return readAll(file)[os] ?? {};
}

// Writes one window's counts into this OS's baseline, leaving other windows
// and other OSes alone, sorted so diffs stay small.
export function updateBaseline(
	windowType,
	violations,
	file = axeBaselinePath,
	os = OS_NAME,
) {
	const all = readAll(file);
	all[os] = sortKeys({
		...all[os],
		[windowType]: countViolations(violations),
	});
	writeFileSync(file, `${JSON.stringify(sortKeys(all), null, "\t")}\n`);
	return all[os][windowType];
}
