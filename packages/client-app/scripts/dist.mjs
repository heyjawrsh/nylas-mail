// `node scripts/dist.mjs <mac|win|linux|host> [--dir|--check-host]` (run as `pnpm --filter
// nylas-mail dist:<os>`): build the unsigned packages for one OS, then rebuild
// the workspace's native modules for the host. The mac x64 leg rebuilds them
// in place, so the restore runs even when the build fails. A good build is
// then checked by scripts/check-public-build.mjs, and a Linux package also by
// scripts/check-glibc-floor.mjs (#21).
//
// `linux` only runs on a Linux host. On a mac use scripts/dist-linux-docker.sh,
// which builds in the pinned Ubuntu 22.04 builder image from a clean copy.
// `--check-host` only runs that refusal, so predist:linux can stop before the
// renderer build.
//
// `host --dir` (run as `build:e2e`) builds only the unpacked app for this OS
// and arch (dist/mac-arm64, dist/mac, dist/linux-unpacked), which is what the
// e2e harness drives.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TARGETS = { mac: "--mac", win: "--win", linux: "--linux" };

const HOSTS = { darwin: "mac", win32: "win", linux: "linux" };
const [requested, ...flags] = process.argv.slice(2);
const target = requested === "host" ? HOSTS[process.platform] : requested;
const dirOnly = flags.includes("--dir");
const FLAGS = new Set(["--dir", "--check-host"]);
if (!TARGETS[target] || flags.some((f) => !FLAGS.has(f))) {
	console.error(
		`usage: dist.mjs <${Object.keys(TARGETS).join("|")}|host> [--dir|--check-host]`,
	);
	process.exit(2);
}

if (target === "linux" && process.platform !== "linux") {
	console.error(
		"dist:linux: build Linux packages on Linux. On this host run packages/client-app/scripts/dist-linux-docker.sh, which builds them in the pinned Ubuntu 22.04 image.",
	);
	process.exit(2);
}
if (flags.includes("--check-host")) process.exit(0);

const run = (command, args) =>
	spawnSync(command, args, { cwd: root, stdio: "inherit", shell: true });

// --dir: the unpacked app only, for this machine's arch
const dirArgs = dirOnly ? ["--dir", `--${process.arch}`] : [];
const build = run("electron-builder", [
	TARGETS[target],
	...dirArgs,
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

// A Linux package must run on glibc 2.35 (Ubuntu 22.04, #21). --dir builds
// (build:e2e) only feed the harness on the build machine, so they skip it.
if (target === "linux" && !dirOnly) {
	const glibc = spawnSync(
		process.execPath,
		[
			path.join(root, "scripts", "check-glibc-floor.mjs"),
			path.join(root, "dist", "linux-unpacked"),
		],
		{ cwd: root, stdio: "inherit" },
	);
	if (glibc.status !== 0) process.exit(glibc.status ?? 1);
}
// a failed restore fails an otherwise good run too
process.exit(restore.status ?? 1);
