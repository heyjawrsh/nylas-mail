#!/usr/bin/env node
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import less from "less";
import { createPlugin } from "./port-less/plugin.mjs";
import { isFontSize } from "./port-less/transforms.mjs";

export const appRoot = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"..",
);
export const emptyReport = () => ({
	literals: [],
	unconvertible: [],
	important: [],
	fontSizeFloor: [],
});
let configuration;

async function loadConfiguration() {
	if (!configuration)
		configuration = (async () => {
			const map = JSON.parse(
				await readFile(
					path.join(appRoot, "src/appearance/legacy-map.json"),
					"utf8",
				),
			);
			const filename = path.join(appRoot, "static/variables/ui-variables.less");
			const source = await readFile(filename, "utf8");
			const names = Object.keys(map).filter(isFontSize);
			const { css } = await less.render(
				`${source}\n.classic-fonts {${names.map((name, i) => `size-${i}: ${name};`).join("")}}`,
				{ filename },
			);
			const classicSizes = Object.fromEntries(
				names.map((name, i) => [
					name,
					Number(css.match(new RegExp(`size-${i}: ([\\d.]+)px`))[1]),
				]),
			);
			const tree = await less.parse(source, { filename });
			const classicDefinitions = Object.fromEntries(
				tree.rules
					.filter((rule) => rule.variable)
					.map((rule) => [rule.name, rule.value]),
			);
			return { map, classicSizes, classicDefinitions };
		})();
	return configuration;
}

export async function compileFile(input) {
	const filename = path.resolve(input);
	const source = await readFile(filename, "utf8");
	const report = emptyReport();
	const config = await loadConfiguration();
	const result = await less.render(source, {
		filename,
		paths: [
			path.join(appRoot, "static/variables"),
			path.join(appRoot, "static"),
		],
		plugins: [createPlugin({ ...config, appRoot, filename, input, report })],
	});
	const leftover = result.css.match(
		/var\(--L-|\d+fz[a-z_]+|__port_floor_|(?<![\w-])(?:darken|lighten|fade|fadeout|mix|desaturate|saturate)\(|@layer\b/,
	);
	if (leftover)
		throw new Error(
			`Unconverted LESS or unsupported layer in output: ${leftover[0]}`,
		);
	return { css: result.css, report };
}

export function outputPath(input, outDir) {
	const relative = path.relative(appRoot, path.resolve(input));
	const target =
		relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)
			? path.basename(input)
			: relative;
	return path.join(outDir, target.replace(/\.less$/i, ".css"));
}

async function main(args) {
	const inputs = [];
	let outDir;
	let reportPath;
	for (let i = 0; i < args.length; i++) {
		if (args[i] === "--out-dir") outDir = args[++i];
		else if (args[i] === "--report") reportPath = args[++i];
		else if (args[i].startsWith("--"))
			throw new Error(`Unknown option: ${args[i]}`);
		else inputs.push(args[i]);
	}
	if (
		!inputs.length ||
		!outDir ||
		!reportPath ||
		inputs.some((input) => !/\.less$/i.test(input))
	) {
		throw new Error(
			"Usage: node scripts/port-less.mjs <file.less>... --out-dir <dir> --report <report.json>",
		);
	}
	const report = emptyReport();
	let completed = 0;
	for (const input of inputs) {
		try {
			const result = await compileFile(input);
			const target = outputPath(input, outDir);
			await mkdir(path.dirname(target), { recursive: true });
			await writeFile(target, result.css);
			for (const key of Object.keys(report))
				report[key].push(...result.report[key]);
			completed++;
		} catch (error) {
			console.error(
				`${input}: ${error.filename || input}${error.line ? `:${error.line}` : ""}: ${error.type || "Error"}: ${error.message}`,
			);
			process.exitCode = 1;
		}
	}
	await mkdir(path.dirname(reportPath), { recursive: true });
	await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
	console.log(
		`Ported ${completed}/${inputs.length} sheets. ${Object.entries(report)
			.map(([key, items]) => `${key}: ${items.length}`)
			.join("; ")}.`,
	);
}

if (
	process.argv[1] &&
	import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
	main(process.argv.slice(2)).catch((error) => {
		console.error(error.message);
		process.exitCode = 1;
	});
}
