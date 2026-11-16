import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import less from "less";
import { expect, it } from "vitest";
import { appRoot, compileFile, emptyReport } from "../scripts/port-less.mjs";

const excluded = new Set(
	["ui-taiga", "ui-darkside", "ui-less-is-more"].map((name) =>
		path.join(appRoot, "internal_packages", name),
	),
);

async function lessFiles(directory) {
	const files = [];
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const filename = path.join(directory, entry.name);
		if (entry.name === "node_modules" || excluded.has(filename)) continue;
		if (entry.isDirectory()) files.push(...(await lessFiles(filename)));
		else if (entry.name.endsWith(".less")) files.push(filename);
	}
	return files.sort();
}

function selectors(css) {
	return new Set(
		[...css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{};]+)\{/g)]
			.map((match) => match[1].trim().replace(/\s+/g, " "))
			.filter(
				(selector) =>
					!selector.startsWith("@") && !/^(from|to|[\d.]+%)$/.test(selector),
			),
	);
}

it("ports every in-scope sheet and preserves all bundle selectors", async () => {
	const files = [
		...(await lessFiles(path.join(appRoot, "static"))),
		...(await lessFiles(path.join(appRoot, "internal_packages"))),
	];
	expect(files.length).toBeGreaterThanOrEqual(106);
	const outputs = new Map();
	const errors = [];
	const report = emptyReport();
	for (const filename of files) {
		try {
			const result = await compileFile(filename);
			outputs.set(filename, result.css);
			for (const key of Object.keys(report))
				report[key].push(...result.report[key]);
		} catch (error) {
			errors.push(`${path.relative(appRoot, filename)}: ${error.message}`);
		}
	}
	expect(errors).toEqual([]);
	expect(outputs.size).toBe(files.length);
	for (const [filename, css] of outputs) {
		expect(css, path.relative(appRoot, filename)).not.toMatch(
			/var\(--L-|\d+fz[a-z_]+|__port_floor_|(?<![\w-])(?:darken|lighten|fade|fadeout|mix|desaturate|saturate)\s*\(|@layer\b/,
		);
	}
	const filename = path.join(appRoot, "static/index.less");
	const plain = await less.render(await readFile(filename, "utf8"), {
		filename,
		paths: [
			path.join(appRoot, "static/variables"),
			path.join(appRoot, "static"),
		],
	});
	const expected = selectors(plain.css);
	const actual = selectors(outputs.get(filename));
	expect(expected.size).toBeGreaterThan(0);
	expect([...expected].filter((selector) => !actual.has(selector))).toEqual([]);
	console.log(
		`Ported ${files.length} sheets. ${Object.entries(report)
			.map(([key, entries]) => `${key}: ${entries.length}`)
			.join("; ")}.`,
	);
}, 60_000);
