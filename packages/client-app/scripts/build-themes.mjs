import { realpathSync } from "node:fs";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { compileTheme } = require("../src/appearance/theme-compiler/index.js");
const defaultDir = fileURLToPath(new URL("../static/themes/", import.meta.url));

export async function buildThemes(dir = defaultDir) {
	const failures = [];
	const files = (await fs.readdir(dir))
		.filter((file) => file.endsWith(".tokens.json"))
		.sort();
	for (const file of files) {
		try {
			const text = await fs.readFile(path.join(dir, file), "utf8");
			const { css, report } = compileTheme(text);
			for (const entry of report) {
				console.error(
					`${file}: ${entry.level}: ${entry.path}: ${entry.message}`,
				);
			}
			if (report.some((entry) => entry.level === "error")) {
				failures.push(file);
				continue;
			}
			const id = JSON.parse(text).$extensions["org.nylas.theme"].id;
			await fs.writeFile(path.join(dir, `${id}.css`), css);
		} catch (error) {
			console.error(`${file}: error: ${error.message}`);
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
