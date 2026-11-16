import { realpathSync } from "node:fs";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { compileTheme } = require("../src/appearance/theme-compiler/index.js");
const defaultDir = fileURLToPath(new URL("../static/themes/", import.meta.url));
export const HC_ALLOWANCE = {
	classic: { missing: ["light-hc", "dark-hc"], until: "story 12" },
};

function descriptorFor(theme, css, report) {
	const metadata = theme.$extensions["org.nylas.theme"];
	const swatch = {};
	// Read compiled values so aliases and colour normalization match the sheet.
	for (const [, variant, declarations] of css.matchAll(
		/\[data-variant="([^"]+)"\] \{([^}]+)\}/g,
	)) {
		const values = Object.fromEntries(
			[
				...declarations.matchAll(
					/--(surface-app|text-default|accent-default): ([^;]+);/g,
				),
			].map(([, role, value]) => [role, value]),
		);
		swatch[variant] = {
			surface: values["surface-app"],
			text: values["text-default"],
			accent: values["accent-default"],
		};
	}
	return {
		id: metadata.id,
		name: metadata.name ?? metadata.id,
		author: metadata.author ?? "Nylas",
		version: metadata.version ?? "1.0.0",
		license: metadata.license ?? "GPL-3.0",
		source: "builtin",
		status: "ok",
		file: `${metadata.id}.tokens.json`,
		error: null,
		revision: 0,
		variants: Object.keys(swatch),
		swatch,
		report: Object.fromEntries(
			["derived", "filledRoles", "rederivedPairs", "fontFamilyName"]
				.filter((key) => Object.hasOwn(report, key))
				.map((key) => [key, report[key]]),
		),
	};
}

export async function buildThemes(dir = defaultDir) {
	const failures = [];
	const warned = new Set();
	const files = (await fs.readdir(dir))
		.filter((file) => file.endsWith(".tokens.json"))
		.sort();
	for (const file of files) {
		try {
			const text = await fs.readFile(path.join(dir, file), "utf8");
			let theme;
			try {
				theme = JSON.parse(text);
			} catch {
				// The compiler reports parse failures with source lines.
			}
			const id = theme?.$extensions?.["org.nylas.theme"]?.id;
			const allowance =
				typeof id === "string" && Object.hasOwn(HC_ALLOWANCE, id)
					? HC_ALLOWANCE[id]
					: undefined;
			const missing =
				allowance?.missing.filter((group) => !Object.hasOwn(theme, group)) ??
				[];
			if (missing.length && !warned.has(id)) {
				console.error(
					`${file}:1: warning: ${id}: missing ${missing.join(", ")} allowed until ${allowance.until}.`,
				);
				warned.add(id);
			}
			const { css, report } = compileTheme(text, {
				builtIn: true,
				allowMissingVariants: allowance?.missing ?? [],
			});
			for (const entry of report) {
				console.error(
					`${file}:${entry.line}: ${entry.level}: ${entry.code}: ${entry.path}: ${entry.message}`,
				);
			}
			if (report.some((entry) => entry.level === "error")) {
				failures.push(file);
				continue;
			}
			await fs.writeFile(path.join(dir, `${id}.css`), css);
			await fs.writeFile(
				path.join(dir, `${id}.descriptor.json`),
				`${JSON.stringify(descriptorFor(theme, css, report), null, "\t")}\n`,
			);
		} catch (error) {
			console.error(`${file}:1: error: ${error.message}`);
			failures.push(file);
		}
	}
	if (failures.length)
		throw new Error(`Theme build failed: ${failures.join(", ")}`);
}

if (
	process.argv[1] &&
	realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))
) {
	try {
		await buildThemes(process.argv[2]);
	} catch (error) {
		console.error(error.message);
		process.exitCode = 1;
	}
}
