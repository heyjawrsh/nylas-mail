// @vitest-environment node
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildThemes } from "../scripts/build-themes.mjs";

const classic = new URL(
	"../static/themes/classic.tokens.json",
	import.meta.url,
);
const script = fileURLToPath(
	new URL("../scripts/build-themes.mjs", import.meta.url),
);
const execFileAsync = promisify(execFile);
let dir;
let errors;

beforeEach(async () => {
	dir = await fs.mkdtemp(path.join(os.tmpdir(), "build-themes-spec-"));
	errors = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(async () => {
	vi.restoreAllMocks();
	await fs.rm(dir, { recursive: true, force: true });
});

describe("theme build", () => {
	it("writes CSS named by the id and ignores other files", async () => {
		await fs.copyFile(classic, path.join(dir, "source.tokens.json"));
		await fs.writeFile(path.join(dir, "ignored.json"), "{");
		await buildThemes(dir);
		expect(await fs.readFile(path.join(dir, "classic.css"), "utf8")).toContain(
			"--surface-app: #f6f6f6;",
		);
		expect(errors).not.toHaveBeenCalled();
	});

	it("names malformed files in reports and failure, and still builds valid files", async () => {
		await fs.writeFile(path.join(dir, "broken.tokens.json"), "{");
		await fs.copyFile(classic, path.join(dir, "valid.tokens.json"));
		await expect(buildThemes(dir)).rejects.toThrow("broken.tokens.json");
		expect(errors).toHaveBeenCalledWith(
			expect.stringContaining("broken.tokens.json: error:"),
		);
		expect(await fs.readdir(dir)).not.toContain("broken.css");
		expect(await fs.readFile(path.join(dir, "classic.css"), "utf8")).toContain(
			"--surface-app: #f6f6f6;",
		);
	});

	it("does not write CSS when the id is missing", async () => {
		await fs.writeFile(path.join(dir, "unnamed.tokens.json"), "{}");
		await expect(buildThemes(dir)).rejects.toThrow("unnamed.tokens.json");
		expect(await fs.readdir(dir)).toEqual(["unnamed.tokens.json"]);
	});

	it("prints warnings without failing", async () => {
		const theme = JSON.parse(await fs.readFile(classic, "utf8"));
		theme.light.size = { $type: "number", $value: 12 };
		await fs.writeFile(
			path.join(dir, "warning.tokens.json"),
			JSON.stringify(theme),
		);
		await buildThemes(dir);
		expect(errors).toHaveBeenCalledWith(
			expect.stringContaining("warning.tokens.json: warning: light.size:"),
		);
	});

	it.each(["../escape", "Classic", "a--b", "a\n"])(
		"does not write CSS for invalid id %j",
		async (id) => {
			await fs.writeFile(
				path.join(dir, "unsafe.tokens.json"),
				JSON.stringify({
					$extensions: { "org.nylas.theme": { id } },
				}),
			);
			await expect(buildThemes(dir)).rejects.toThrow("unsafe.tokens.json");
			expect(await fs.readdir(dir)).toEqual(["unsafe.tokens.json"]);
		},
	);

	it.each(["malformed JSON", "invalid colour", "missing type"])(
		"preserves existing CSS on %s and exits 1 naming the file",
		async (failure) => {
			await fs.copyFile(classic, path.join(dir, "classic.tokens.json"));
			await buildThemes(dir);
			const previous = await fs.readFile(path.join(dir, "classic.css"), "utf8");
			const theme = JSON.parse(await fs.readFile(classic, "utf8"));
			if (failure === "invalid colour")
				theme.light.surface.app.$value = "invalid";
			if (failure === "missing type") delete theme.light.surface.app.$type;
			await fs.writeFile(
				path.join(dir, "classic.tokens.json"),
				failure === "malformed JSON" ? "{" : JSON.stringify(theme),
			);
			await expect(
				execFileAsync(process.execPath, [script, dir]),
			).rejects.toMatchObject({
				code: 1,
				stderr: expect.stringContaining("classic.tokens.json"),
			});
			expect(await fs.readFile(path.join(dir, "classic.css"), "utf8")).toBe(
				previous,
			);
		},
	);

	it("exits 1 and names the file when the CLI encounters an error", async () => {
		await fs.writeFile(path.join(dir, "broken.tokens.json"), "{");
		await expect(
			execFileAsync(process.execPath, [script, dir]),
		).rejects.toMatchObject({
			code: 1,
			stderr: expect.stringContaining("broken.tokens.json"),
		});
	});
});
