#!/usr/bin/env node
// Fails when app source uses a React API that React 19 removed.
// Later React 19 stories add an entry to BANNED once its last use is gone.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"..",
);

const ROOTS = [
	"packages/client-app/src",
	"packages/client-app/internal_packages",
];
const SKIP_DIRS = new Set(["spec", "vendor", "node_modules"]);
const EXTENSIONS = new Set([".js", ".jsx"]);

// Names react-dom no longer exports.
const REMOVED_DOM_NAMES = "render|hydrate|unmountComponentAtNode";
const REACT_DOM = `["']react-dom["']`;

// Each entry: a label for the report, a regex run over the whole file (so it
// can span lines), and what to use instead. A line is reported once, under
// the first entry that matches it.
export const BANNED = [
	{
		label: "ReactDOM.render",
		pattern: /\bReactDOM\.render\(/,
		why: "use createRoot from react-dom/client",
	},
	{
		label: "ReactDOM.hydrate",
		pattern: /\bReactDOM\.hydrate\(/,
		why: "use hydrateRoot from react-dom/client",
	},
	{
		label: 'require("react-dom").render/.hydrate',
		pattern: new RegExp(
			String.raw`require\(\s*${REACT_DOM}\s*\)\s*\.\s*(?:render|hydrate)\b`,
		),
		why: "use createRoot or hydrateRoot from react-dom/client",
	},
	{
		label: "named import of a removed react-dom API",
		pattern: new RegExp(
			String.raw`\bimport\s*\{[^}]*\b(?:${REMOVED_DOM_NAMES})\b[^}]*\}\s*from\s*${REACT_DOM}`,
		),
		why: "use createRoot/hydrateRoot and root.unmount() from react-dom/client",
	},
	{
		label: "destructured require of a removed react-dom API",
		pattern: new RegExp(
			String.raw`\{[^}]*\b(?:${REMOVED_DOM_NAMES})\b[^}]*\}\s*=\s*require\(\s*${REACT_DOM}\s*\)`,
		),
		why: "use createRoot/hydrateRoot and root.unmount() from react-dom/client",
	},
	{
		label: "unmountComponentAtNode",
		pattern: /\bunmountComponentAtNode\b/,
		why: "use root.unmount()",
	},
	{
		label: "childContextTypes",
		pattern: /\bchildContextTypes\b/,
		why: "use React.createContext",
	},
	{
		label: "contextTypes",
		pattern: /\bcontextTypes\b/,
		why: "use static contextType with a createContext object",
	},
	{
		label: "getChildContext",
		pattern: /\bgetChildContext\b/,
		why: "use a context Provider",
	},
];

function* sourceFiles(dir) {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		if (entry.isDirectory()) {
			if (!SKIP_DIRS.has(entry.name))
				yield* sourceFiles(path.join(dir, entry.name));
		} else if (EXTENSIONS.has(path.extname(entry.name))) {
			yield path.join(dir, entry.name);
		}
	}
}

const lineAt = (text, index) => text.slice(0, index).split("\n").length;

const findings = [];
for (const root of ROOTS) {
	for (const file of sourceFiles(path.join(repoRoot, root))) {
		const text = readFileSync(file, "utf8");
		const reported = new Set();
		for (const { label, pattern, why } of BANNED) {
			const global = new RegExp(pattern.source, `${pattern.flags}g`);
			for (const match of text.matchAll(global)) {
				const line = lineAt(text, match.index);
				if (reported.has(line)) continue;
				reported.add(line);
				findings.push({
					file: path.relative(repoRoot, file),
					line,
					text: `${label} (${why})`,
				});
			}
		}
	}
}

if (findings.length > 0) {
	findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
	console.error(`Removed React APIs found (${findings.length}):`);
	for (const { file, line, text } of findings) {
		console.error(`  ${file}:${line}: ${text}`);
	}
	process.exit(1);
}
console.log("No removed React APIs in src/ or internal_packages/.");
