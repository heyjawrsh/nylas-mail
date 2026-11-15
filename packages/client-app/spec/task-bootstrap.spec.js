import { fork } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const bootstrap = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"../src/task-bootstrap.js",
);

describe("task bootstrap", () => {
	let directory;
	let child;

	beforeEach(() => {
		directory = mkdtempSync(path.join(tmpdir(), "nylas-task-bootstrap-"));
		child = null;
	});

	afterEach(async () => {
		try {
			if (child && child.exitCode === null && child.signalCode === null) {
				const exited = once(child, "exit");
				child.kill("SIGKILL");
				await exited;
			}
		} finally {
			rmSync(directory, { recursive: true, force: true });
		}
	});

	const start = (source, args) => {
		const taskPath = path.join(directory, "handler.cjs");
		writeFileSync(taskPath, source);
		child = fork(bootstrap, [], {
			env: { ...process.env, taskPath },
			silent: true,
		});
		const message = once(child, "message", { signal: AbortSignal.timeout(3000) });
		child.send({ event: "start", args });
		return message;
	};

	it("exits within three seconds when its parent disconnects (#24)", async () => {
		const [message] = await start(
			"module.exports = function () { this.async(); setInterval(() => console.log('t'), 20); };",
			[],
		);
		expect(message).toEqual({ event: "task:log", args: ["t"] });
		const exited = once(child, "exit", { signal: AbortSignal.timeout(3000) });
		child.disconnect();
		await expect(exited).resolves.toEqual([0, null]);
	});

	it("reports the result of a synchronous task", async () => {
		const [message] = await start("module.exports = (a, b) => a + b;", [2, 3]);
		expect(message).toEqual({ event: "task:completed", args: [5] });
	});
});
