// `pnpm --filter nylas-mail dist:mac`: build the unsigned macOS packages,
// then rebuild the workspace's native modules for the host arch. The x64 leg
// rebuilds them in place, so the restore runs even when the build fails.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const electronBuilder = (args) =>
	spawnSync("electron-builder", args, {
		cwd: root,
		stdio: "inherit",
		shell: true,
	});

const build = electronBuilder(["--mac", "--config", "electron-builder.yml"]);
const restore = electronBuilder(["install-app-deps"]);
if (restore.status !== 0) {
	console.error("dist:mac: restoring host-arch native modules failed");
}
// the build's status; a failed restore fails an otherwise good run too
const buildStatus = build.status ?? 1;
process.exit(buildStatus !== 0 ? buildStatus : (restore.status ?? 1));
