import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const { parseTree, getNodeValue } = require("jsonc-parser");
const { ROLES } = require("../src/appearance/theme-compiler/contract.js");
const designPath = new URL(
	"../../../_bmad-output/initiative-theme-and-style-system/ux-theme-and-style-system/DESIGN.md",
	import.meta.url,
);
const variablesPath = new URL(
	"../static/variables/ui-variables.less",
	import.meta.url,
);
const sourcePath = new URL(
	"../src/appearance/legacy-map.source.json",
	import.meta.url,
);
const outputPath = new URL(
	"../src/appearance/legacy-map.json",
	import.meta.url,
);
const heading = "### LESS variable → role mapping (legacy themes)";

function parseMap(text) {
	const errors = [];
	const tree = parseTree(text, errors, {
		disallowComments: true,
		allowTrailingComma: false,
	});
	if (errors.length || tree?.type !== "object")
		throw new Error("Expected a strict JSON map.");
	function checkKeys(node, variable = "") {
		if (node.type !== "object") return;
		const seen = new Set();
		for (const property of node.children) {
			const [key, value] = property.children;
			if (seen.has(key.value))
				throw new Error(`Doubled ${variable || key.value}: ${key.value}`);
			seen.add(key.value);
			checkKeys(value, variable || key.value);
		}
	}
	checkKeys(tree);
	return getNodeValue(tree);
}

export function buildLegacyMap({
	design = readFileSync(designPath, "utf8"),
	variables = readFileSync(variablesPath, "utf8"),
	source = readFileSync(sourcePath, "utf8"),
} = {}) {
	const names = new Set();
	for (const [, name] of variables.matchAll(/^(@[\w-]+):/gm)) {
		if (names.has(name)) throw new Error(`Doubled LESS variable: ${name}`);
		names.add(name);
	}
	const supplement = parseMap(source);
	const start = design.indexOf(heading);
	if (start < 0) throw new Error(`Missing DESIGN heading: ${heading}`);
	const section = design.slice(start + heading.length).split(/^#{1,3} /m)[0];
	const rows = new Map();
	for (const line of section.split(/\r?\n/)) {
		if (!line.startsWith("|")) continue;
		const [, first, second] = line.split("|");
		// A base source starts with a variable, not a theme name or an expression.
		const name = first.trim().match(/^`(@[\w-]+)`/)?.[1];
		const role = second?.trim().match(/^`([\w-]+)`$/)?.[1];
		if (!name || !role) continue;
		if (rows.has(name) && !Object.hasOwn(supplement, name)) {
			throw new Error(
				`Doubled DESIGN variable: ${name}; resolve it in the supplement.`,
			);
		}
		rows.set(name, { kind: "colour", css: `var(--${role})` });
	}
	// Context-specific DESIGN rows need an explicit, documented default.
	const merged = { ...Object.fromEntries(rows), ...supplement };
	for (const name of Object.keys(merged)) {
		if (!names.has(name)) throw new Error(`Extra variable: ${name}`);
	}
	for (const name of names) {
		const entry = merged[name];
		if (!entry) throw new Error(`Missing variable: ${name}`);
		if (!["colour", "dimension", "font", "literal"].includes(entry.kind)) {
			throw new Error(`Invalid kind: ${name}`);
		}
		if (typeof entry.css !== "string" || !entry.css.trim())
			throw new Error(`Missing CSS: ${name}`);
		if (
			(entry.kind === "literal" || Object.hasOwn(supplement, name)) &&
			(typeof entry.note !== "string" || !entry.note.trim())
		) {
			throw new Error(`Missing note: ${name}`);
		}
		if (
			/@[\w-]+|~["']|(?<![\w-])(?:darken|lighten|fade|fadeout|desaturate|saturate|mix|floor)\s*\(/.test(
				entry.css,
			)
		) {
			throw new Error(`LESS syntax in CSS: ${name}`);
		}
		for (const [, role] of entry.css.matchAll(/var\(\s*--([\w-]+)/g)) {
			if (role !== "text-scale" && !Object.hasOwn(ROLES, role)) {
				throw new Error(`Unknown role --${role}: ${name}`);
			}
		}
	}
	return Object.fromEntries(
		[...names].sort().map((name) => [name, merged[name]]),
	);
}

export function checkLegacyMap(committed, generated) {
	const expected = `${JSON.stringify(generated, null, "\t")}\n`;
	if (committed === expected) return [];
	const actual = parseMap(committed);
	const differing = [
		...new Set([...Object.keys(actual), ...Object.keys(generated)]),
	]
		.sort()
		.filter(
			(name) =>
				JSON.stringify(actual[name]) !== JSON.stringify(generated[name]),
		);
	// Formatting and ordering are also part of the generated-file contract.
	return differing.length ? differing : Object.keys(generated);
}

if (
	process.argv[1] &&
	pathToFileURL(process.argv[1]).href === import.meta.url
) {
	try {
		const map = buildLegacyMap();
		if (process.argv.includes("--check")) {
			let committed;
			try {
				committed = readFileSync(outputPath, "utf8");
			} catch (error) {
				if (error.code !== "ENOENT") throw error;
				committed = "{}";
			}
			const differing = checkLegacyMap(committed, map);
			if (differing.length) {
				console.error(`Legacy map differs:\n${differing.join("\n")}`);
				process.exitCode = 1;
			}
		} else {
			writeFileSync(outputPath, `${JSON.stringify(map, null, "\t")}\n`);
			console.log(
				`Wrote ${Object.keys(map).length} variables to ${fileURLToPath(outputPath)}`,
			);
		}
	} catch (error) {
		console.error(error.message);
		process.exitCode = 1;
	}
}
