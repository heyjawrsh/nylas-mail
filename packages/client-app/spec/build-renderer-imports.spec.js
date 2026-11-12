// @vitest-environment node
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { build } from "esbuild";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildOptions, entries } from "../scripts/build-renderer.js";

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
