// Every Linux build uses one pinned builder image (#21): the e2e container,
// the local Docker package build, the stock-22.04 proof and CI's dist job.
// A copy that drifts would build or test on a different glibc and toolchain.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repo = path.resolve(app, "..", "..");
const FILES = [
	path.join(app, "e2e", "linux-docker.sh"),
	path.join(app, "scripts", "dist-linux-docker.sh"),
	path.join(app, "e2e", "linux-deb-docker.sh"),
	path.join(repo, ".github", "workflows", "dist.yml"),
];
// an image reference (with a tag or digest), not the name in a comment
const IMAGE = /electronuserland\/builder(?:@sha256:[0-9a-f]{64}|:[\w.-]+)/g;

describe("Linux builder image", () => {
	it.each(FILES.map((f) => [path.relative(repo, f), f]))(
		"%s pins the builder image by digest",
		(_name, file) => {
			const refs = readFileSync(file, "utf8").match(IMAGE) ?? [];
			expect(refs.length).toBeGreaterThan(0);
			for (const ref of refs) expect(ref).toMatch(/@sha256:[0-9a-f]{64}$/);
		},
	);

	it("is the same digest everywhere", () => {
		const digests = new Set(
			FILES.flatMap((f) => readFileSync(f, "utf8").match(IMAGE) ?? []),
		);
		expect([...digests]).toHaveLength(1);
	});

	it("pins the stock ubuntu:22.04 image by digest", () => {
		const text = readFileSync(FILES[2], "utf8");
		expect(text).toMatch(/ubuntu@sha256:[0-9a-f]{64}/);
	});
});
