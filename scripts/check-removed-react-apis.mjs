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

// The internal packages that are clean of the path-scoped entries below:
// thread-list, message-list, composer and every composer-* plugin.
const MAIL_PACKAGES =
	/^packages\/client-app\/internal_packages\/(?:thread-list|message-list|composer(?:-[^/]+)?)\//;
const CLEAN = ["packages/client-app/src", MAIL_PACKAGES];

// Each entry: a label for the report, a regex run over the whole file (so it
// can span lines), and what to use instead. An entry with `only` checks just
// the paths it lists: a string is a folder prefix, a regex is tested against
// the repo-relative path. A line is reported once, under the first entry that
// matches it.
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
	// The entries below cover src/ and the mail packages for now; the rest of
	// internal_packages/ joins them once its last use is gone.
	{
		label: "findDOMNode",
		pattern: /\bfindDOMNode\b/,
		why: "put a ref on the element, or call the child's getDOMNode()",
		only: CLEAN,
	},
	{
		label: "string ref",
		// ref="x" or ref='x' in JSX, and ref: "x" in createElement props.
		pattern: /\bref\s*[=:]\s*["']/,
		why: "use createRef() or a callback ref",
		only: CLEAN,
	},
	{
		label: "string ref",
		pattern: /\bref\s*=\s*\{\s*["'`]/,
		why: "use createRef() or a callback ref",
		only: CLEAN,
	},
	{
		label: "this.refs",
		pattern: /\.refs\b/,
		why: "read the object ref's .current",
		only: CLEAN,
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

const inScope = (only, rel) =>
	!only ||
	only.some((scope) =>
		typeof scope === "string"
			? rel === scope || rel.startsWith(`${scope}/`)
			: scope.test(rel),
	);

// Scans the ROOTS under `root` and returns { file, line, text } findings,
// file relative to `root`. Exported so the spec can run it on fixtures.
export function findRemovedReactApis(root = repoRoot) {
	const findings = [];
	for (const scanRoot of ROOTS) {
		for (const file of sourceFiles(path.join(root, scanRoot))) {
			const text = readFileSync(file, "utf8");
			const rel = path.relative(root, file).split(path.sep).join("/");
			const reported = new Set();
			for (const { label, pattern, why, only } of BANNED) {
				if (!inScope(only, rel)) continue;
				const global = new RegExp(pattern.source, `${pattern.flags}g`);
				for (const match of text.matchAll(global)) {
					const line = lineAt(text, match.index);
					if (reported.has(line)) continue;
					reported.add(line);
					findings.push({
						file: rel,
						line,
						text: `${label} (${why})`,
					});
				}
			}
		}
	}
	return findings.sort(
		(a, b) => a.file.localeCompare(b.file) || a.line - b.line,
	);
}

const runAsScript =
	process.argv[1] &&
	path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (runAsScript) {
	const findings = findRemovedReactApis();
	if (findings.length > 0) {
		console.error(`Removed React APIs found (${findings.length}):`);
		for (const { file, line, text } of findings) {
			console.error(`  ${file}:${line}: ${text}`);
		}
		process.exit(1);
	}
	console.log("No removed React APIs in src/ or internal_packages/.");
}
