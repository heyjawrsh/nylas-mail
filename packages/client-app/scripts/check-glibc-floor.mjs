#!/usr/bin/env node
// glibc floor guard for a built Linux package (#21). Fails when any ELF file
// under <dir> needs a glibc symbol version newer than the floor, which is
// 2.35 (Ubuntu 22.04 LTS; Debian 12 has 2.36).
//
// Usage: node scripts/check-glibc-floor.mjs <dir> [--max 2.35]
//
// It checks the shipped binaries, not the build host: a source build on a
// newer runner can still link 2.38-and-later symbols. Needs objdump
// (binutils), which the electronuserland/builder image has.
import { spawnSync } from "node:child_process";
import {
	closeSync,
	openSync,
	readdirSync,
	readSync,
	realpathSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const DEFAULT_MAX = "2.35";
const ELF_MAGIC = Buffer.from([0x7f, 0x45, 0x4c, 0x46]); // \x7fELF

// GLIBC_2.2.5, GLIBC_2.38 and so on. GLIBCXX_*, GLIBC_PRIVATE and other
// libraries' version names don't match.
const GLIBC_VERSION = /\bGLIBC_(\d+(?:\.\d+)+)\b/g;

// Every distinct glibc version named in `objdump -T` output.
export function parseGlibcVersions(objdumpText) {
	const found = new Set();
	for (const match of objdumpText.matchAll(GLIBC_VERSION)) found.add(match[1]);
	return [...found];
}

// Numeric, part by part: 2.10 > 2.9, and 2.2.5 > 2.2.
export function compareVersions(a, b) {
	const pa = a.split(".").map(Number);
	const pb = b.split(".").map(Number);
	for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
		const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
		if (diff !== 0) return Math.sign(diff);
	}
	return 0;
}

export function highestVersion(versions) {
	let highest = null;
	for (const v of versions) {
		if (highest === null || compareVersions(v, highest) > 0) highest = v;
	}
	return highest;
}

export function isElf(file) {
	const fd = openSync(file, "r");
	try {
		const head = Buffer.alloc(ELF_MAGIC.length);
		const read = readSync(fd, head, 0, head.length, 0);
		return read === head.length && head.equals(ELF_MAGIC);
	} finally {
		closeSync(fd);
	}
}

// Regular files only; symlinks are skipped so a link to a shipped binary
// isn't checked twice and a link out of the package isn't followed.
export function* elfFiles(dir) {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) yield* elfFiles(full);
		else if (entry.isFile() && isElf(full)) yield full;
	}
}

export function objdumpSymbols(file) {
	const result = spawnSync("objdump", ["-T", file], {
		encoding: "utf8",
		maxBuffer: 256 * 1024 * 1024,
	});
	if (result.error) {
		throw new Error(`objdump failed on ${file}: ${result.error.message}`);
	}
	// objdump exits non-zero on a static binary, which needs no glibc at all:
	// "not a dynamic object" (esbuild's Go binaries) or "no dynamic symbol
	// table".
	if (
		result.status !== 0 &&
		/not a dynamic object|no dynamic symbol table/i.test(result.stderr)
	) {
		return "";
	}
	if (result.status !== 0) {
		throw new Error(`objdump failed on ${file}: ${result.stderr.trim()}`);
	}
	return result.stdout;
}

// { checked, over: [{ file, version }] } for every ELF file under dir whose
// highest glibc version is over max.
export function findOverFloor(
	dir,
	{ max = DEFAULT_MAX, readSymbols = objdumpSymbols } = {},
) {
	const over = [];
	let checked = 0;
	for (const file of elfFiles(dir)) {
		checked++;
		const version = highestVersion(parseGlibcVersions(readSymbols(file)));
		if (version && compareVersions(version, max) > 0) {
			over.push({ file, version });
		}
	}
	return { checked, over };
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
	const args = process.argv.slice(2);
	let max = DEFAULT_MAX;
	const dirs = [];
	for (let i = 0; i < args.length; i++) {
		if (args[i] === "--max") max = args[++i];
		else dirs.push(args[i]);
	}
	if (dirs.length !== 1 || !/^\d+(\.\d+)+$/.test(max ?? "")) {
		console.error("usage: check-glibc-floor.mjs <dir> [--max 2.35]");
		process.exit(2);
	}
	const dir = path.resolve(dirs[0]);
	const { checked, over } = findOverFloor(dir, { max });
	// a dir with no binaries is a wrong path, not a pass
	if (checked === 0) {
		console.error(`No ELF files found in ${dir}`);
		process.exit(1);
	}
	if (over.length > 0) {
		console.error(
			`Binaries in ${dir} that need a glibc newer than ${max} (${over.length}):`,
		);
		for (const { file, version } of over) {
			console.error(`  ${path.relative(dir, file)}: GLIBC_${version}`);
		}
		process.exit(1);
	}
	console.log(
		`glibc floor check passed: ${checked} ELF files in ${dir} need glibc ${max} or older.`,
	);
}
