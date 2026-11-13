// The axe gate. axe-baseline.json records today's violations, keyed by
// window type, then rule id, then node count. A window fails on a rule id
// that isn't in its baseline or a node count above it; fewer nodes pass (the
// baseline can then be shrunk). Only `--update-axe-baseline` rewrites the
// file, and it says so when it does.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const axeBaselinePath = path.join(here, "axe-baseline.json");

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

export function readBaseline(file = axeBaselinePath) {
	return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
}

// Writes one window's counts into the baseline file, sorted so diffs stay
// small.
export function updateBaseline(windowType, violations, file = axeBaselinePath) {
	const all = readBaseline(file);
	all[windowType] = countViolations(violations);
	const sorted = Object.fromEntries(
		Object.entries(all).sort(([a], [b]) => a.localeCompare(b)),
	);
	writeFileSync(file, `${JSON.stringify(sorted, null, "\t")}\n`);
	return sorted[windowType];
}
