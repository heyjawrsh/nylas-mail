// dist:linux refuses to build on a non-Linux host and points at the Docker
// build (#21). The script runs with process.platform forced, so this never
// starts a real build on any host.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(app, "scripts", "dist.mjs");

const forcePlatform = (platform) =>
	// single quotes: NODE_OPTIONS treats double quotes as quoting
	`data:text/javascript,Object.defineProperty(process,'platform',{value:'${platform}'})`;

const runAs = (platform, ...args) =>
	spawnSync(
		process.execPath,
		[
			"--import",
			forcePlatform(platform),
			dist,
			...args,
		],
		{ cwd: app, encoding: "utf8" },
	);

describe("dist.mjs linux on a non-Linux host", () => {
	it.each(["darwin", "win32"])(
		"exits 2 on %s and names the Docker script",
		(platform) => {
			const result = runAs(platform, "linux");
			expect(result.status).toBe(2);
			expect(result.stderr).toContain("scripts/dist-linux-docker.sh");
		},
	);

	it("refuses --dir too", () => {
		const result = runAs("darwin", "linux", "--dir");
		expect(result.status).toBe(2);
		expect(result.stderr).toContain("scripts/dist-linux-docker.sh");
	});
});

describe("predist:linux", () => {
	const predist = JSON.parse(readFileSync(path.join(app, "package.json"), "utf8"))
		.scripts["predist:linux"];

	it("checks the host before the renderer build", () => {
		const check = predist.indexOf("dist.mjs linux --check-host");
		expect(check).toBeGreaterThanOrEqual(0);
		expect(check).toBeLessThan(predist.indexOf("build-renderer.js"));
	});

	it("stops on a non-Linux host before build-renderer runs", () => {
		// NODE_OPTIONS reaches every node the script starts, so if the check
		// didn't stop it, build-renderer would run and the status would differ
		const result = spawnSync(predist, {
			cwd: app,
			shell: true,
			encoding: "utf8",
			env: { ...process.env, NODE_OPTIONS: `--import=${forcePlatform("darwin")}` },
		});
		expect(result.status).toBe(2);
		expect(result.stderr).toContain("scripts/dist-linux-docker.sh");
	});

	it("--check-host passes on Linux without building", () => {
		const result = runAs("linux", "linux", "--check-host");
		expect(result.stderr).toBe("");
		expect(result.status).toBe(0);
	});
});
