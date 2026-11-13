// Runs the removed-React-API check (scripts/check-removed-react-apis.mjs) on
// fixture trees in a temp dir laid out like the repo.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { findRemovedReactApis } from "../../../scripts/check-removed-react-apis.mjs";

const SRC = "packages/client-app/src";
const INTERNAL = "packages/client-app/internal_packages";

let root;
const write = (rel, text) => {
	const file = path.join(root, rel);
	mkdirSync(path.dirname(file), { recursive: true });
	writeFileSync(file, text);
};
const findingsIn = (rel) =>
	findRemovedReactApis(root).filter((f) => f.file === rel);

beforeEach(() => {
	root = mkdtempSync(path.join(os.tmpdir(), "check-react-apis-"));
	mkdirSync(path.join(root, SRC), { recursive: true });
	mkdirSync(path.join(root, INTERNAL), { recursive: true });
});
afterEach(() => {
	rmSync(root, { recursive: true, force: true });
});

const cases = [
	["findDOMNode", "findDOMNode", "export const a = (c) => ReactDOM.findDOMNode(c);\n"],
	["a JSX string ref", "string ref", 'export const a = <div ref="box" />;\n'],
	["a JSX single-quoted string ref", "string ref", "export const a = <div ref='box' />;\n"],
	["a createElement string ref", "string ref", 'export const a = createElement("div", { ref: "box" });\n'],
	["a JSX expression string ref", "string ref", "export const a = <div ref={`box-${id}`} />;\n"],
	[".refs", "this.refs", "export const a = (c) => c.refs.box;\n"],
];

describe("check-removed-react-apis path-scoped entries", () => {
	it.each(cases)("flags %s under src with file:line", (_name, label, code) => {
		const rel = `${SRC}/components/probe.jsx`;
		write(rel, `// probe\n${code}`);
		const [finding, ...rest] = findingsIn(rel);
		expect(rest).toEqual([]);
		expect(finding).toMatchObject({ file: rel, line: 2 });
		expect(finding.text.startsWith(label)).toBe(true);
	});

	it.each(cases)("does not flag %s under other internal_packages", (_name, _label, code) => {
		const rel = `${INTERNAL}/some-plugin/lib/probe.jsx`;
		write(rel, code);
		expect(findingsIn(rel)).toEqual([]);
	});

	const mailPackages = [
		"thread-list",
		"message-list",
		"composer",
		"composer-emoji",
		"composer-mail-merge",
		"composer-scheduler/lib/composer",
	];
	const mailCases = mailPackages.flatMap((pkg) => cases.map(([name, label, code]) => [pkg, name, label, code]));

	it.each(mailCases)("flags %s's %s with file:line", (pkg, _name, label, code) => {
		const rel = `${INTERNAL}/${pkg}/probe.jsx`;
		write(rel, `// probe\n${code}`);
		const [finding, ...rest] = findingsIn(rel);
		expect(rest).toEqual([]);
		expect(finding).toMatchObject({ file: rel, line: 2 });
		expect(finding.text.startsWith(label)).toBe(true);
	});

	it("does not treat a package that only starts with a mail package name as one", () => {
		for (const pkg of ["thread-list-extras", "message-list2", "composerish"]) {
			const rel = `${INTERNAL}/${pkg}/lib/probe.jsx`;
			write(rel, "export const a = (c) => c.refs.box;\n");
			expect(findingsIn(rel)).toEqual([]);
		}
	});

	it("passes on the repo's own mail packages", () => {
		const repoRoot = path.resolve(__dirname, "..", "..", "..");
		const inMail = findRemovedReactApis(repoRoot).filter((f) =>
			/internal_packages\/(thread-list|message-list|composer(-[^/]+)?)\//.test(f.file),
		);
		expect(inMail).toEqual([]);
	});

	it("does not flag href= attributes or ?ref= query strings", () => {
		const rel = `${SRC}/links.jsx`;
		write(
			rel,
			[
				'export const a = <a href="https://example.com">x</a>;',
				"export const b = '<a href=\"https://nylas.com?ref=n1\">Nylas</a>';",
				'export const c = createElement("a", { href: "https://example.com" });',
				"export const d = { prefs: 1, preferences: 2 };",
				"",
			].join("\n"),
		);
		expect(findingsIn(rel)).toEqual([]);
	});

	it("does not scan spec or vendor directories", () => {
		write(`${SRC}/spec/probe.jsx`, "export const a = (c) => c.refs.box;\n");
		write(`${SRC}/vendor/probe.js`, "export const a = (c) => ReactDOM.findDOMNode(c);\n");
		expect(findRemovedReactApis(root)).toEqual([]);
	});

	it("still applies the unscoped entries to internal_packages", () => {
		const rel = `${INTERNAL}/plugin/lib/old.jsx`;
		write(rel, "class A { getChildContext() {} }\n");
		expect(findingsIn(rel)).toMatchObject([{ line: 1, text: expect.stringMatching(/^getChildContext/) }]);
	});
});
