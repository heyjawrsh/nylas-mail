// dist:linux refuses to build on a non-Linux host and points at the Docker
// build (#21). The script runs with process.platform forced, so this never
// starts a real build on any host.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(app, "scripts", "dist.mjs");

const runAs = (platform, ...args) =>
	spawnSync(
		process.execPath,
		[
			"--import",
			`data:text/javascript,Object.defineProperty(process,"platform",{value:${JSON.stringify(platform)}})`,
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
