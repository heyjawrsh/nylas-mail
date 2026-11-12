#!/usr/bin/env node
// Fails when app source uses a React API that React 19 removed.
// Later React 19 stories add their pattern to BANNED once its last use is gone.
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

export const BANNED = [
	{ text: "ReactDOM.render(", why: "use createRoot from react-dom/client" },
	{ text: "unmountComponentAtNode", why: "use root.unmount()" },
	{ text: "childContextTypes", why: "use React.createContext" },
	{
		text: "contextTypes",
		why: "use static contextType with a createContext object",
	},
	{ text: "getChildContext", why: "use a context Provider" },
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

const findings = [];
for (const root of ROOTS) {
	for (const file of sourceFiles(path.join(repoRoot, root))) {
		const lines = readFileSync(file, "utf8").split("\n");
		lines.forEach((line, index) => {
			// childContextTypes also contains contextTypes; report it once.
			const hit = BANNED.find(({ text }) => line.includes(text));
			if (hit) {
				findings.push(
					`${path.relative(repoRoot, file)}:${index + 1}: ${hit.text} (${hit.why})`,
				);
			}
		});
	}
}

if (findings.length > 0) {
	console.error(`Removed React APIs found (${findings.length}):`);
	for (const finding of findings) console.error(`  ${finding}`);
	process.exit(1);
}
console.log("No removed React APIs in src/ or internal_packages/.");
