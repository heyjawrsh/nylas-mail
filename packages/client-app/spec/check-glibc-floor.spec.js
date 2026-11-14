// The glibc floor check (scripts/check-glibc-floor.mjs, #21) on captured
// `objdump -T` text and fixture packages in a temp dir. The CLI tests put a
// fake objdump on PATH, so they need no binutils and no real ELF binaries.
import { spawnSync } from "node:child_process";
import {
	chmodSync,
	mkdirSync,
	mkdtempSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
	compareVersions,
	elfFiles,
	findOverFloor,
	highestVersion,
	isElf,
	parseGlibcVersions,
} from "../scripts/check-glibc-floor.mjs";

const script = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"../scripts/check-glibc-floor.mjs",
);

// From `objdump -T` on Ubuntu 22.04's libstdc++.so.6, plus a 2.38 reference
// like the prebuilt sqlite3 binary's (#21).
const header = `x.node:     file format elf64-x86-64

DYNAMIC SYMBOL TABLE:
0000000000000000      DF *UND*	0000000000000000 (GLIBC_2.2.5) chdir
0000000000000000  w   D  *UND*	0000000000000000  Base        _ITM_memcpyRtWn
0000000000000000      DF *UND*	0000000000000000 (GLIBC_2.4)  __wmemmove_chk
`;
const OVER = `${header}0000000000000000      DF *UND*	0000000000000000 (GLIBC_2.38) __isoc23_strtol
`;
const AT = `${header}0000000000000000      DF *UND*	0000000000000000 (GLIBC_2.35) __memcpy_chk
`;
const UNDER = `${header}0000000000000000      DF *UND*	0000000000000000 (GLIBC_2.34) pthread_join
`;
// libstdc++ and zlib versions, and glibc's private one, aren't glibc floors
const NOT_GLIBC = `${header}0000000000000000      DF *UND*	0000000000000000 (GLIBCXX_3.4.30) _ZSt28__throw_bad_array_new_lengthv
0000000000000000 g    DO *ABS*	0000000000000000  ZLIB_1.2.9  ZLIB_1.2.9
0000000000000000      DF *UND*	0000000000000000 (GLIBC_PRIVATE) _dl_find_object
`;

const ELF_HEADER = Buffer.from([0x7f, 0x45, 0x4c, 0x46, 2, 1, 1, 0]);

let root;
const write = (rel, data = "") => {
	const file = path.join(root, rel);
	mkdirSync(path.dirname(file), { recursive: true });
	writeFileSync(file, data);
	return file;
};
const writeElf = (rel) => write(rel, ELF_HEADER);

beforeEach(() => {
	root = mkdtempSync(path.join(os.tmpdir(), "check-glibc-floor-"));
});
afterEach(() => {
	rmSync(root, { recursive: true, force: true });
});

describe("parseGlibcVersions", () => {
	it("finds every distinct glibc version", () => {
		expect(parseGlibcVersions(OVER).sort()).toEqual(["2.2.5", "2.38", "2.4"]);
	});

	it("ignores GLIBCXX, GLIBC_PRIVATE and other libraries' versions", () => {
		expect(parseGlibcVersions(NOT_GLIBC).sort()).toEqual(["2.2.5", "2.4"]);
	});

	it("finds nothing in a binary with no glibc references", () => {
		expect(parseGlibcVersions("DYNAMIC SYMBOL TABLE:\n")).toEqual([]);
	});
});

describe("compareVersions and highestVersion", () => {
	it.each([
		["2.38", "2.35", 1],
		["2.35", "2.35", 0],
		["2.34", "2.35", -1],
		["2.10", "2.9", 1],
		["2.2.5", "2.2", 1],
		["2.2", "2.2.0", 0],
	])("%s vs %s is %i", (a, b, expected) => {
		expect(compareVersions(a, b)).toBe(expected);
	});

	it("picks the highest numerically, not by string", () => {
		expect(highestVersion(["2.2.5", "2.10", "2.4", "2.9"])).toBe("2.10");
		expect(highestVersion([])).toBeNull();
	});
});

describe("ELF detection", () => {
	it("picks out ELF files by magic and skips everything else", () => {
		const binary = writeElf("nylas-mail");
		const addon = writeElf("resources/app.asar.unpacked/x/sqlite3.node");
		write("resources/app.asar", "asar");
		write("resources/app.asar.unpacked/x/index.js", "module.exports = 1;\n");
		write("icon.png", Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]));
		write("tiny", Buffer.from([0x7f, 0x45]));
		write("empty", "");
		symlinkSync(binary, path.join(root, "link-to-binary"));
		expect(isElf(binary)).toBe(true);
		expect(isElf(path.join(root, "icon.png"))).toBe(false);
		expect([...elfFiles(root)].sort()).toEqual([binary, addon].sort());
	});
});

describe("findOverFloor", () => {
	const symbols = (byName) => (file) => {
		const text = byName[path.basename(file)];
		if (text === undefined) throw new Error(`read a non-ELF file: ${file}`);
		return text;
	};

	it("flags only the binary over the floor, with its highest version", () => {
		const over = writeElf("resources/app.asar.unpacked/a/over.node");
		writeElf("at.so");
		writeElf("under");
		write("resources/app.asar", "not elf");
		const result = findOverFloor(root, {
			readSymbols: symbols({ "over.node": OVER, "at.so": AT, under: UNDER }),
		});
		expect(result).toEqual({
			checked: 3,
			over: [{ file: over, version: "2.38" }],
		});
	});

	it("passes a package within the floor", () => {
		writeElf("at.so");
		writeElf("notglibc.node");
		expect(
			findOverFloor(root, {
				readSymbols: symbols({ "at.so": AT, "notglibc.node": NOT_GLIBC }),
			}),
		).toEqual({ checked: 2, over: [] });
	});

	it("honours a different max", () => {
		writeElf("at.so");
		expect(
			findOverFloor(root, { max: "2.34", readSymbols: symbols({ "at.so": AT }) })
				.over,
		).toEqual([{ file: path.join(root, "at.so"), version: "2.35" }]);
	});
});

describe("check-glibc-floor CLI", () => {
	// A fake objdump that prints the fixture text named by the file's name.
	let bin;
	beforeEach(() => {
		bin = path.join(root, "bin");
		mkdirSync(bin);
		const fixtures = path.join(root, "fixtures");
		mkdirSync(fixtures);
		writeFileSync(path.join(fixtures, "over.node"), OVER);
		writeFileSync(path.join(fixtures, "at.so"), AT);
		const fake = path.join(bin, "objdump");
		writeFileSync(
			fake,
			`#!/bin/sh\ncat "${fixtures}/$(basename "$2")"\n`,
		);
		chmodSync(fake, 0o755);
	});
	const run = (...args) =>
		spawnSync(process.execPath, [script, ...args], {
			encoding: "utf8",
			env: { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}` },
		});

	it.skipIf(process.platform === "win32")(
		"exits non-zero naming the file and version over the floor",
		() => {
			const pkg = path.join(root, "linux-unpacked");
			mkdirSync(pkg);
			writeFileSync(path.join(pkg, "at.so"), ELF_HEADER);
			mkdirSync(path.join(pkg, "resources"));
			writeFileSync(path.join(pkg, "resources", "over.node"), ELF_HEADER);
			writeFileSync(path.join(pkg, "resources", "app.asar"), "asar");
			const result = run(pkg);
			expect(result.status).toBe(1);
			expect(result.stderr).toContain(
				`${path.join("resources", "over.node")}: GLIBC_2.38`,
			);
			expect(result.stderr).not.toContain("at.so");
			expect(result.stderr).not.toContain("app.asar");
		},
	);

	it.skipIf(process.platform === "win32")(
		"exits 0 when every binary is within the floor",
		() => {
			const pkg = path.join(root, "linux-unpacked");
			mkdirSync(pkg);
			writeFileSync(path.join(pkg, "at.so"), ELF_HEADER);
			writeFileSync(path.join(pkg, "index.js"), "1;\n");
			const result = run(pkg);
			expect(result.stderr).toBe("");
			expect(result.stdout).toContain("glibc floor check passed: 1 ELF files");
			expect(result.status).toBe(0);
		},
	);

	it("fails on a dir with no ELF files, so a wrong path can't pass", () => {
		const pkg = path.join(root, "linux-unpacked");
		mkdirSync(pkg);
		writeFileSync(path.join(pkg, "index.js"), "1;\n");
		const result = run(pkg);
		expect(result.status).toBe(1);
		expect(result.stderr).toContain("No ELF files");
	});

	it("exits 2 on bad usage", () => {
		expect(run().status).toBe(2);
		expect(run(root, "--max", "latest").status).toBe(2);
	});
});
