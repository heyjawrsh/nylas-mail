// Renderer errors the harness tolerates. Each entry in known-errors.json
// names a matcher and the open issue that owns it; anything else fails the
// window's test.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const knownErrorsPath = path.join(here, "known-errors.json");

const ISSUE = /^https:\/\/github\.com\/[^/]+\/[^/]+\/issues\/\d+$/;

// Validates and compiles the known-errors entries. `match` is a regular
// expression source; `windows` (optional) limits the entry to those window
// types. An entry with no issue link is an error, not a silent pass.
export function compileKnownErrors(entries) {
	if (!Array.isArray(entries)) {
		throw new Error("known-errors.json must be an array");
	}
	return entries.map((entry, i) => {
		if (typeof entry?.match !== "string" || !entry.match) {
			throw new Error(`known-errors.json[${i}] has no "match"`);
		}
		if (typeof entry.issue !== "string" || !ISSUE.test(entry.issue)) {
			throw new Error(
				`known-errors.json[${i}] (${entry.match}) must name the open issue that owns it as a GitHub issue URL`,
			);
		}
		return { ...entry, regex: new RegExp(entry.match) };
	});
}

export function loadKnownErrors(file = knownErrorsPath) {
	return compileKnownErrors(JSON.parse(readFileSync(file, "utf8")));
}

const matches = (known, error) =>
	known.regex.test(error.text) &&
	(!known.windows || known.windows.includes(error.window));

// The collected errors ({ window, kind, text }) that no known entry matches.
export function unexpectedErrors(errors, known) {
	return errors.filter((e) => !known.some((k) => matches(k, e)));
}

export function formatErrors(errors) {
	return errors
		.map((e) => `[${e.window}] ${e.kind}: ${e.text.split("\n")[0]}`)
		.join("\n");
}
