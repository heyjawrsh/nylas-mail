// @vitest-environment node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const nodeRequire = createRequire(import.meta.url);
const compiler = nodeRequire("../src/compile-support/babel.js");

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtures = path.join(appRoot, "spec", "fixtures", "compile-support");
const inApp = (...parts) => path.join(appRoot, ...parts);

// Runs compile-cache's require hook in a clean Node process, so the hook
// never touches this worker's loader.
const requireThroughCompileCache = (target, cacheDir) => {
	const script = `
		const path = require("node:path");
		const CompileCache = require(${JSON.stringify(inApp("src", "compile-cache.js"))});
		CompileCache.setCacheDirectory(${JSON.stringify(cacheDir)});
		try {
			const mod = require(${JSON.stringify(target)});
			const out = { label: mod.label, kind: mod.kind };
			if (typeof mod.default === "function") {
				const el = mod.default();
				out.element = { type: el.type, className: el.props.className, children: el.props.children };
			}
			process.stdout.write(JSON.stringify(out));
		} catch (err) {
			process.stdout.write(JSON.stringify({ error: err.message, name: err.name }));
		}
	`;
	const res = spawnSync(process.execPath, ["-e", script], { cwd: appRoot, encoding: "utf8" });
	if (res.status !== 0) throw new Error(res.stderr);
	return JSON.parse(res.stdout);
};

describe("esbuild require-time compiler", () => {
	it("compiles .jsx under the app root", () => {
		expect(compiler.shouldCompile("<div />", inApp("internal_packages", "x", "lib", "a.jsx"))).toBe(true);
	});

	it("compiles ESM-syntax .js under the app root", () => {
		const file = inApp("internal_packages", "x", "lib", "main.js");
		expect(compiler.shouldCompile('import a from "./a";', file)).toBe(true);
		expect(compiler.shouldCompile("export default 1;", file)).toBe(true);
		expect(compiler.shouldCompile("const x = import.meta.url;", file)).toBe(true);
	});

	it("leaves CommonJS .js to Node", () => {
		const file = inApp("src", "plain.js");
		expect(compiler.shouldCompile('const a = require("a");\nmodule.exports = a;', file)).toBe(false);
		expect(compiler.shouldCompile('const later = import("./x");', file)).toBe(false);
		expect(compiler.shouldCompile("// important: exports.x = 1\nexports.x = 1;", file)).toBe(false);
	});

	it("never compiles node_modules, generated bundles, or files outside the app", () => {
		expect(compiler.shouldCompile("export default 1;", inApp("node_modules", "pkg", "index.js"))).toBe(false);
		expect(compiler.shouldCompile("<div />", inApp("node_modules", "pkg", "view.jsx"))).toBe(false);
		expect(compiler.shouldCompile("export default 1;", inApp("static", "window-bootstrap.bundle.js"))).toBe(false);
		expect(compiler.shouldCompile("<div />", path.join(os.tmpdir(), "elsewhere.jsx"))).toBe(false);
	});

	it("emits CommonJS with an inline source map", () => {
		const code = compiler.compile(
			'import React from "react";\nexport default function A() { return <b>hi</b>; }\n',
			inApp("internal_packages", "x", "lib", "a.jsx"),
		);
		expect(code).toMatch(/module\.exports/);
		expect(code).toMatch(/require\("react\/jsx-runtime"\)/);
		expect(code).not.toMatch(/^\s*import /m);
		expect(code).toMatch(/\/\/# sourceMappingURL=data:application\/json;base64,/);
	});

	it("keys the cache on the source", () => {
		const file = inApp("internal_packages", "x", "lib", "a.jsx");
		const first = compiler.getCachePath("<a />", file);
		expect(compiler.getCachePath("<a />", file)).toBe(first);
		expect(compiler.getCachePath("<b />", file)).not.toBe(first);
		expect(first).toMatch(/^esbuild[\\/][0-9a-f]{40}\.js$/);
	});

	it("names the file and line of a syntax error", () => {
		const file = inApp("internal_packages", "x", "lib", "broken.jsx");
		let error;
		try {
			compiler.compile("const ok = 1;\nconst = ;\n", file);
		} catch (err) {
			error = err;
		}
		expect(error).toBeInstanceOf(SyntaxError);
		expect(error.message).toContain(`${file}:2:`);
		expect(error.line).toBe(2);
	});
});

describe("compile-cache require hook", () => {
	const tmpDirs = [];
	const tmpCache = () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nylas-compile-cache-"));
		tmpDirs.push(dir);
		return dir;
	};
	afterEach(() => {
		for (const dir of tmpDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
	});

	it("loads an ESM .jsx module and its extensionless ESM .js import", () => {
		const cacheDir = tmpCache();
		const out = requireThroughCompileCache(path.join(fixtures, "esm-page"), cacheDir);
		expect(out).toEqual({
			label: "esm-page",
			element: { type: "div", className: "page", children: "compiled" },
		});
		// both files went through esbuild and were cached
		expect(fs.readdirSync(path.join(cacheDir, "esbuild"))).toHaveLength(2);
	});

	it("serves a second load from the cache", () => {
		const cacheDir = tmpCache();
		requireThroughCompileCache(path.join(fixtures, "esm-page.jsx"), cacheDir);
		const cached = fs.readdirSync(path.join(cacheDir, "esbuild"));
		const out = requireThroughCompileCache(path.join(fixtures, "esm-page.jsx"), cacheDir);
		expect(out.label).toBe("esm-page");
		expect(fs.readdirSync(path.join(cacheDir, "esbuild"))).toEqual(cached);
	});

	it("leaves CommonJS modules uncompiled", () => {
		const cacheDir = tmpCache();
		const out = requireThroughCompileCache(path.join(fixtures, "cjs-helper.js"), cacheDir);
		expect(out.kind).toBe("commonjs");
		expect(fs.existsSync(path.join(cacheDir, "esbuild"))).toBe(false);
	});

	it("reports a syntax error with the file and line", () => {
		const cacheDir = tmpCache();
		const broken = path.join(fixtures, `broken-${process.pid}.jsx`);
		fs.writeFileSync(broken, "export const a = 1;\nexport const = ;\n");
		try {
			const out = requireThroughCompileCache(broken, cacheDir);
			expect(out.name).toBe("SyntaxError");
			expect(out.error).toContain(`${broken}:2:`);
		} finally {
			fs.rmSync(broken, { force: true });
		}
	});
});
