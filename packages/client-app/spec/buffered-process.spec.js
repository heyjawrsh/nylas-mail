import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

// Real child processes: the exit callback bug (#17) only shows when the
// streams close and the process exits for real.
const BufferedProcess = createRequire(import.meta.url)("../src/buffered-process.js");

const run = (command, args) =>
	new Promise((resolve) => {
		const out = [];
		const proc = new BufferedProcess({
			command,
			args,
			stdout: (lines) => out.push(lines),
			stderr: () => {},
			exit: (code) => resolve({ code, out: out.join(""), proc }),
		});
		proc.onWillThrowError(({ error, handle }) => {
			handle();
			resolve({ error, proc });
		});
	});

describe("BufferedProcess", () => {
	it("calls exit once stdout, stderr and the process have all finished", async () => {
		const { code, out } = await run(process.execPath, ["-e", "console.log('hi')"]);
		expect(code).toBe(0);
		expect(out).toBe("hi\n");
	});

	it("reports the exit code", async () => {
		const { code } = await run(process.execPath, ["-e", "process.exit(3)"]);
		expect(code).toBe(3);
	});

	it("hands a missing command to will-throw-error instead of throwing", async () => {
		const { error } = await run("/nonexistent/apm", ["ls"]);
		expect(error.code).toBe("ENOENT");
	});

	it("skips the exit callback after kill", async () => {
		let exited = false;
		const proc = new BufferedProcess({
			command: process.execPath,
			args: ["-e", "setTimeout(() => {}, 5000)"],
			stdout: () => {},
			exit: () => { exited = true; },
		});
		proc.kill();
		await new Promise((resolve) => setTimeout(resolve, 200));
		expect(exited).toBe(false);
	});
});
