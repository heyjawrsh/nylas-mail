// `node scripts/dist.mjs <mac|win|linux>` (run as `pnpm --filter nylas-mail
// dist:<os>`): build the unsigned packages for one OS, then rebuild the
// workspace's native modules for the host. The mac x64 leg rebuilds them in
// place, so the restore runs even when the build fails. A good build is then
// checked by scripts/check-public-build.mjs.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TARGETS = { mac: "--mac", win: "--win", linux: "--linux" };

const target = process.argv[2];
if (!TARGETS[target]) {
	console.error(`usage: dist.mjs <${Object.keys(TARGETS).join("|")}>`);
	process.exit(2);
}

const run = (command, args) =>
	spawnSync(command, args, { cwd: root, stdio: "inherit", shell: true });

const build = run("electron-builder", [
	TARGETS[target],
	"--config",
	"electron-builder.yml",
	"--publish",
	"never",
]);
const restore = run("electron-builder", ["install-app-deps"]);
if (restore.status !== 0) {
	console.error(`dist:${target}: restoring host native modules failed`);
}
const buildStatus = build.status ?? 1;
if (buildStatus !== 0) process.exit(buildStatus);

// node directly, no shell, so paths need no quoting on any OS
const check = spawnSync(
	process.execPath,
	[
		path.join(root, "..", "..", "scripts", "check-public-build.mjs"),
		path.join(root, "dist"),
	],
	{ cwd: root, stdio: "inherit" },
);
if (check.status !== 0) process.exit(check.status ?? 1);
// a failed restore fails an otherwise good run too
process.exit(restore.status ?? 1);
