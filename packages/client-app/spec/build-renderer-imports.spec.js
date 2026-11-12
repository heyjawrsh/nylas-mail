// @vitest-environment node
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { build } from "esbuild";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildOptions, entries } from "../scripts/build-renderer.js";

const execFileAsync = promisify(execFile);
const quiet = { write: false, logLevel: "silent" };

describe("renderer bundle imports", () => {
	it.each(entries.map((entry) => [entry.out, entry]))(
		"%s builds with no undefined imports",
		async (_name, entry) => {
			const result = await build({ ...buildOptions(entry), ...quiet });
			expect(result.errors).toEqual([]);
			expect(
				result.warnings.filter((w) => w.id === "import-is-undefined"),
			).toEqual([]);
		},
		60_000,
	);
});

describe("build options", () => {
	let dir;

	beforeAll(async () => {
		dir = await fs.mkdtemp(path.join(os.tmpdir(), "build-renderer-spec-"));
		await fs.writeFile(
			path.join(dir, "target.js"),
			"export const Present = 1;\n",
		);
		// Stands in for nylas-component-kit.js: a class whose prototype getter
		// counts reads, published the way the real kit publishes its class.
		await fs.writeFile(
			path.join(dir, "fake-kit.js"),
			[
				"class Kit {}",
				'Object.defineProperty(Kit.prototype, "Modal", {',
				"\tget() { globalThis.__kitReads += 1; return 'ModalComponent'; },",
				"});",
				"globalThis.NylasComponentKitClass = Kit;",
				"",
			].join("\n"),
		);
	});

	afterAll(async () => {
		delete globalThis.NylasComponentKitClass;
		await fs.rm(dir, { recursive: true, force: true });
	});

	// The shape of the ContactStore / ExtensionRegistry bugs: a namespace
	// import read for a name the module doesn't export. esbuild only warns.
	const undefinedImport = (logOverride) =>
		build({
			stdin: {
				contents:
					'import * as Target from "./target.js";\n\nconsole.log(Target.Missing);\n',
				resolveDir: dir,
				sourcefile: "importer.js",
			},
			bundle: true,
			format: "cjs",
			platform: "node",
			logOverride,
			...quiet,
		});

	it("is only a warning without the override", async () => {
		const result = await undefinedImport(undefined);
		expect(result.warnings.map((w) => w.id)).toContain("import-is-undefined");
	});

	it("fails the build on an import its target doesn't export, naming file and line", async () => {
		const { logOverride } = buildOptions(entries[0]);
		const failure = await undefinedImport(logOverride).then(
			() => null,
			(error) => error,
		);
		expect(failure).not.toBeNull();
		const [error] = failure.errors;
		expect(error.text).toMatch(/Import "Missing" will always be undefined/);
		expect(error.location.file).toMatch(/importer\.js$/);
		expect(error.location.line).toBe(3);
	});

	it("gives bundled code one lazy kit instance through the shim", async () => {
		const { alias } = buildOptions(entries[0]);
		const fakeKit = path.join(dir, "fake-kit.js");
		const result = await build({
			stdin: {
				contents: [
					'import { Modal } from "nylas-component-kit";',
					'import kitA from "nylas-component-kit";',
					'const kitB = require("nylas-component-kit");',
					"module.exports = { read: () => Modal, kitA, kitB };",
					"",
				].join("\n"),
				resolveDir: dir,
				sourcefile: "consumer.js",
			},
			bundle: true,
			format: "cjs",
			platform: "node",
			alias: { "nylas-component-kit": alias["nylas-component-kit"] },
			plugins: [
				{
					name: "fake-kit",
					setup(b) {
						b.onResolve({ filter: /^\.\/nylas-component-kit\.js$/ }, () => ({
							path: fakeKit,
						}));
					},
				},
			],
			...quiet,
		});
		globalThis.__kitReads = 0;
		const mod = { exports: {} };
		new Function("module", "exports", "require", result.outputFiles[0].text)(
			mod,
			mod.exports,
			() => {
				throw new Error("unexpected runtime require");
			},
		);
		const { read, kitA, kitB } = mod.exports;

		// loading the bundle reads no component
		expect(globalThis.__kitReads).toBe(0);
		expect(read()).toBe("ModalComponent");
		expect(globalThis.__kitReads).toBe(1);
		// import and require (register-bundled-modules) share the instance
		expect(kitA).toBe(kitB);
		expect(kitA).toBeInstanceOf(globalThis.NylasComponentKitClass);
		expect(kitA.NylasComponentKit).toBe(globalThis.NylasComponentKitClass);
		delete globalThis.__kitReads;
	});
});

describe("kit named-import check", () => {
	let dir;

	beforeAll(async () => {
		dir = await fs.mkdtemp(path.join(os.tmpdir(), "build-renderer-kit-"));
	});

	afterAll(async () => {
		await fs.rm(dir, { recursive: true, force: true });
	});

	it("fails the build on a name the kit doesn't register, naming file, line and name", async () => {
		const importer = path.join(dir, "importer.jsx");
		await fs.writeFile(
			importer,
			'import { Modal,\n\tModl } from "nylas-component-kit";\n\nexport default [Modal, Modl];\n',
		);
		const failure = await build({
			...buildOptions(entries[0]),
			entryPoints: [importer],
			...quiet,
		}).then(
			() => null,
			(error) => error,
		);
		expect(failure).not.toBeNull();
		expect(failure.errors).toHaveLength(1);
		const [error] = failure.errors;
		expect(error.text).toMatch(/Import "Modl" from "nylas-component-kit"/);
		expect(error.location.file).toMatch(/importer\.jsx$/);
		expect(error.location.line).toBe(2);
		expect(error.location.lineText).toContain("Modl");
	}, 60_000);
});

describe("real kit in the bundle", () => {
	let dir;

	beforeAll(async () => {
		dir = await fs.mkdtemp(path.join(os.tmpdir(), "build-renderer-real-kit-"));
	});

	afterAll(async () => {
		await fs.rm(dir, { recursive: true, force: true });
	});

	it("makes no second instance and hands packages the bundle's own one", async () => {
		const root = path.resolve(import.meta.dirname, "..");
		const outfile = path.join(dir, "probe.bundle.js");
		await build({
			...buildOptions(entries[0]),
			entryPoints: undefined,
			stdin: {
				contents: [
					'const Module = require("node:module");',
					// the bundle file's own module, which the kit's free `module` names
					// (nylas-exports.js also assigns it); record every assignment
					"const bundleModule = require.main;",
					"const assigned = [];",
					"let current = bundleModule.exports;",
					'Object.defineProperty(bundleModule, "exports", { get: () => current, set: (v) => { assigned.push(v); current = v; } });',
					// register-bundled-modules only patches resolution in a window
					"globalThis.window = globalThis;",
					// the app's NylasEnv answers this; the kit loads src/ files by it
					"globalThis.NylasEnv = { getResourcePath: () => process.cwd(), inDevMode: () => false };",
					'require("./src/register-bundled-modules.js");',
					'const bundled = require("nylas-component-kit");',
					// a runtime require, as an internal package makes it
					'const viaResolver = Module.createRequire(__filename)("nylas-component-kit");',
					"const Kit = globalThis.NylasComponentKitClass;",
					"process.stdout.write(JSON.stringify({",
					"\tsame: bundled === viaResolver,",
					"\tisKit: bundled instanceof Kit,",
					"\tclassHandle: bundled.NylasComponentKit === Kit,",
					"\tregistered: typeof Object.getOwnPropertyDescriptor(Kit.prototype, \"Modal\")?.get,",
					"\tkitInstances: assigned.filter((v) => v instanceof Kit).length,",
					"}));",
					"",
				].join("\n"),
				resolveDir: root,
				sourcefile: "probe.js",
			},
			outfile,
			logLevel: "silent",
		});
		const env = { ...process.env };
		delete env.VITEST; // the real kit registers its getters outside vitest
		const { stdout } = await execFileAsync(process.execPath, [outfile], {
			env,
			cwd: root,
		});
		expect(JSON.parse(stdout)).toEqual({
			same: true,
			isKit: true,
			classHandle: true,
			registered: "function",
			kitInstances: 0,
		});
	}, 60_000);
});
