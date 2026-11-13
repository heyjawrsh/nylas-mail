#!/usr/bin/env node
// Public-build guard. Fails when:
// - app source turns crash-report upload back on (heyjawrsh/nylas-mail#8), or
// - a built package holds the licensed fonts (architecture AD-17).
//
// Usage: pnpm check:public-build [distDir…]
// With no dirs it checks the source, plus packages/client-app/dist if present.
// A dir that is given but holds no package fails, so CI can't pass on nothing.
import {
	existsSync,
	readdirSync,
	readFileSync,
	realpathSync,
	statSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import asar from "@electron/asar";

const repoRoot = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"..",
);

// client-sync ships too: electron-builder copies ../client-sync into the
// package. Its symlink under internal_packages isn't followed, so it's
// scanned at its real path.
const SOURCE_ROOTS = [
	"packages/client-app/src",
	"packages/client-app/internal_packages",
	"packages/client-sync",
];
const SKIP_DIRS = new Set(["node_modules", "spec", "coverage"]);
const EXTENSIONS = new Set([".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx"]);

// Each crashReporter option that sends dumps somewhere.
export const UPLOAD_SETTINGS = [
	{ label: "submitURL", pattern: /\bsubmitURL\b/ },
	{ label: "autoSubmit", pattern: /\bautoSubmit\b/ },
	{ label: "uploadToServer: true", pattern: /\buploadToServer\s*:\s*true\b/ },
];

// A path inside the app that is the licensed font package or one of its
// fonts (Nylas-Pro-*.otf), wherever it was copied to.
const PRIVATE_FONT_PATHS = [
	/(?:^|\/)nylas-private-fonts(?:\/|$)/,
	/(?:^|\/)Nylas-Pro[^/]*\.(?:otf|ttf|woff2?|eot)$/i,
];
const isPrivateFont = (p) => PRIVATE_FONT_PATHS.some((re) => re.test(p));

function* sourceFiles(dir) {
	if (!existsSync(dir)) return;
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			if (!SKIP_DIRS.has(entry.name)) yield* sourceFiles(full);
		} else if (EXTENSIONS.has(path.extname(entry.name))) {
			yield full;
		}
	}
}

const toPosix = (p) => p.split(path.sep).join("/");

// { file, line, text } for each upload setting in the source roots under
// `root`, file relative to `root`.
export function findUploadSettings(root = repoRoot) {
	const findings = [];
	for (const scanRoot of SOURCE_ROOTS) {
		for (const file of sourceFiles(path.join(root, scanRoot))) {
			const lines = readFileSync(file, "utf8").split("\n");
			lines.forEach((text, i) => {
				const hit = UPLOAD_SETTINGS.find(({ pattern }) => pattern.test(text));
				if (hit) {
					findings.push({
						file: toPosix(path.relative(root, file)),
						line: i + 1,
						text: `${hit.label} (crash reports must stay local: uploadToServer: false, no submit URL)`,
					});
				}
			});
		}
	}
	return findings;
}

// The resources dir of each package under `dir`: `*.app` bundles (mac) and
// `*-unpacked` dirs (win, linux; the exe, AppImage and deb are built from
// them). Doesn't descend into a package once found.
export function findPackages(dir, depth = 3) {
	const found = [];
	const name = path.basename(dir);
	if (name.endsWith(".app")) {
		const resources = path.join(dir, "Contents", "Resources");
		if (existsSync(resources)) found.push({ package: dir, resources });
		return found;
	}
	if (name.endsWith("-unpacked")) {
		const resources = path.join(dir, "resources");
		if (existsSync(resources)) found.push({ package: dir, resources });
		return found;
	}
	if (depth === 0) return found;
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		if (entry.isDirectory()) {
			found.push(...findPackages(path.join(dir, entry.name), depth - 1));
		}
	}
	return found;
}

function* walk(dir, prefix = "") {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
		yield rel;
		if (entry.isDirectory()) yield* walk(path.join(dir, entry.name), rel);
	}
}

// Every app path in a package's resources dir: the asar's entries, the
// unpacked files beside it, and a loose `app` dir if there's no asar.
export function appContents(resources) {
	const paths = [];
	const archive = path.join(resources, "app.asar");
	if (existsSync(archive)) {
		for (const entry of asar.listPackage(archive, { isPack: false })) {
			paths.push(`app.asar${toPosix(entry)}`);
		}
	}
	for (const loose of ["app.asar.unpacked", "app"]) {
		const dir = path.join(resources, loose);
		if (existsSync(dir) && statSync(dir).isDirectory()) {
			for (const rel of walk(dir)) paths.push(`${loose}/${rel}`);
		}
	}
	return paths;
}

// { package, path } for each private-font path in the packages under the
// given dist dirs, plus { dir, error } for a dir with no package in it.
export function findPrivateFonts(distDirs) {
	const findings = [];
	const empty = [];
	for (const dir of distDirs) {
		const packages = existsSync(dir) ? findPackages(dir) : [];
		if (packages.length === 0) empty.push(dir);
		for (const pkg of packages) {
			for (const p of appContents(pkg.resources)) {
				if (isPrivateFont(p)) {
					findings.push({ package: pkg.package, path: p });
				}
			}
		}
	}
	return { findings, empty };
}

// realpaths, so a run through a symlinked path (/tmp -> /private/tmp)
// still counts as a direct run
const realpath = (p) => {
	try {
		return realpathSync(p);
	} catch {
		return p;
	}
};
const runAsScript =
	process.argv[1] &&
	realpath(path.resolve(process.argv[1])) ===
		realpath(fileURLToPath(import.meta.url));

if (runAsScript) {
	let distDirs = process.argv.slice(2).map((d) => path.resolve(d));
	if (distDirs.length === 0) {
		const fallback = path.join(repoRoot, "packages/client-app/dist");
		distDirs = existsSync(fallback) ? [fallback] : [];
	}
	let failed = false;

	const uploads = findUploadSettings();
	if (uploads.length > 0) {
		failed = true;
		console.error(`Crash-report upload settings found (${uploads.length}):`);
		for (const { file, line, text } of uploads) {
			console.error(`  ${file}:${line}: ${text}`);
		}
	}

	const { findings, empty } = findPrivateFonts(distDirs);
	for (const dir of empty) {
		failed = true;
		console.error(`No package (*.app or *-unpacked) found in ${dir}`);
	}
	if (findings.length > 0) {
		failed = true;
		console.error(`Licensed fonts found in a package (${findings.length}):`);
		for (const f of findings) console.error(`  ${f.package}: ${f.path}`);
	}

	if (failed) process.exit(1);
	const checked = distDirs.length
		? `source and ${distDirs.join(", ")}`
		: "source (no dist dir to check)";
	console.log(`Public build check passed: ${checked}.`);
}
