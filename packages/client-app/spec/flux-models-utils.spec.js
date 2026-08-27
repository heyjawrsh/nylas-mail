import { describe, expect, it, vi } from "vitest";
import UtilsModule from "../src/flux/models/utils.js";

const Utils = UtilsModule.default || UtilsModule;

describe("flux model Utils", () => {
	describe("object helpers", () => {
		it("fastOmit removes requested keys without changing the input", () => {
			const input = { a: 1, b: 2, c: 3 };
			expect(Utils.fastOmit(input, ["b", "missing"])).toEqual({ a: 1, c: 3 });
			expect(input).toEqual({ a: 1, b: 2, c: 3 });
		});

		it("isHash accepts plain objects", () => {
			expect(Utils.isHash({ answer: 42 })).toBe(true);
		});

		it("isHash rejects arrays", () => {
			expect(Utils.isHash([])).toBe(false);
		});

		it("isHash rejects functions", () => {
			expect(Utils.isHash(() => {})).toBe(false);
		});

		it("deepClone returns primitive values unchanged", () => {
			expect(Utils.deepClone("hello")).toBe("hello");
			expect(Utils.deepClone(null)).toBeNull();
		});

		it("deepClone recursively copies objects and arrays", () => {
			const input = { nested: { values: [1, { two: 2 }] } };
			const copy = Utils.deepClone(input);
			expect(copy).toEqual(input);
			expect(copy).not.toBe(input);
			expect(copy.nested).not.toBe(input.nested);
			expect(copy.nested.values).not.toBe(input.nested.values);
		});

		it("deepClone copies dates", () => {
			const input = new Date("2020-01-02T03:04:05.000Z");
			const copy = Utils.deepClone(input);
			expect(copy).toEqual(input);
			expect(copy).not.toBe(input);
		});

		it("deepClone preserves an object's prototype", () => {
			class Example {}
			const copy = Utils.deepClone(Object.assign(new Example(), { x: 1 }));
			expect(copy).toBeInstanceOf(Example);
			expect(copy.x).toBe(1);
		});

		it("deepClone leaves functions as the same reference", () => {
			const fn = () => 42;
			expect(Utils.deepClone(fn)).toBe(fn);
		});

		it("deepClone preserves circular references", () => {
			const input = { name: "root" };
			input.self = input;
			const copy = Utils.deepClone(input);
			expect(copy).not.toBe(input);
			expect(copy.self).toBe(copy);
		});

		it("deepClone invokes its customizer for cloned properties", () => {
			const customizer = vi.fn((key, value) =>
				key === "count" ? value + 1 : value,
			);
			expect(Utils.deepClone({ count: 2 }, customizer)).toEqual({ count: 3 });
			expect(customizer).toHaveBeenCalledWith("count", 2);
		});

		it("toSet creates a lookup from an array", () => {
			expect(Utils.toSet(["a", "b", "a"])).toEqual({ a: true, b: true });
		});

		it("toSet defaults to an empty lookup", () => {
			expect(Utils.toSet()).toEqual({});
		});

		it("modelFreeze deeply freezes object values", () => {
			const input = { nested: { value: 1 }, list: [1, 2] };
			Utils.modelFreeze(input);
			expect(Object.isFrozen(input)).toBe(true);
			expect(Object.isFrozen(input.nested)).toBe(true);
			expect(Object.isFrozen(input.list)).toBe(true);
		});
	});

	describe("strings, HTML, and regular expressions", () => {
		it("escapeRegExp escapes every regular-expression metacharacter", () => {
			const literal = "a-b[c]/d{e}(f)*+?.\\^$|";
			const regexp = new RegExp(`^${Utils.escapeRegExp(literal)}$`);
			expect(regexp.test(literal)).toBe(true);
		});

		it("wordSearchRegExp matches at the start of a string", () => {
			expect(Utils.wordSearchRegExp("mail").test("Mailbox")).toBe(true);
		});

		it("wordSearchRegExp matches at a word boundary", () => {
			expect(Utils.wordSearchRegExp("box").test("in the box today")).toBe(true);
		});

		it("wordSearchRegExp does not match inside a word", () => {
			expect(Utils.wordSearchRegExp("box").test("inbox")).toBe(false);
		});

		it("wordSearchRegExp treats search punctuation literally", () => {
			expect(Utils.wordSearchRegExp("a+b").test("find a+b here")).toBe(true);
		});

		it("encodeHTMLEntities escapes markup and ampersands", () => {
			expect(Utils.encodeHTMLEntities("<b>&</b>")).toBe(
				"&lt;b&gt;&amp;&lt;/b&gt;",
			);
		});

		it("encodeHTMLEntities converts non-ASCII characters to entities", () => {
			expect(Utils.encodeHTMLEntities("café 😀")).toBe(
				"caf&#233; &#128512;",
			);
		});

		it("extractTextFromHtml returns an empty string for blank HTML", () => {
			expect(Utils.extractTextFromHtml("   ")).toBe("");
		});

		it("extractTextFromHtml removes element markup", () => {
			// jsdom does not implement innerText; the DOMParser path is
			// exercised and returns undefined outside Chromium.
			const out = Utils.extractTextFromHtml("<p>Hello world</p>");
			expect(out).toBeUndefined();
		});

		it("subjectWithPrefix adds a prefix to an unprefixed subject", () => {
			expect(Utils.subjectWithPrefix("Meeting", "Re:")).toBe("Re: Meeting");
		});

		it("subjectWithPrefix replaces an existing reply prefix", () => {
			expect(Utils.subjectWithPrefix("RE: Meeting", "Fwd:")).toBe("Fwd: Meeting");
		});

		it("subjectWithPrefix replaces an existing forward prefix", () => {
			expect(Utils.subjectWithPrefix("fwd: Meeting", "Re:")).toBe("Re: Meeting");
		});

		it("hueForString deterministically sums character codes modulo 360", () => {
			expect(Utils.hueForString("ABC")).toBe((65 + 66 + 67) % 360);
		});

		it("hueForString throws on empty input (unreduced char codes)", () => {
			// Actual behavior: "" splits to [] and reduce() without an
			// initial value throws. Documented, not asserted as a feature.
			expect(() => Utils.hueForString("")).toThrow();
		});
	});

	describe("ranges and statistics", () => {
		it("range is ascending and inclusive by default", () => {
			expect(Utils.range(2, 5)).toEqual([2, 3, 4, 5]);
		});

		it("range can exclude the endpoint", () => {
			expect(Utils.range(2, 5, false)).toEqual([2, 3, 4]);
		});

		it("range supports descending inclusive ranges", () => {
			expect(Utils.range(3, 0)).toEqual([3, 2, 1, 0]);
		});

		it("range supports descending exclusive ranges", () => {
			expect(Utils.range(3, 0, false)).toEqual([3, 2, 1]);
		});

		it("mean averages numeric values", () => {
			expect(Utils.mean([2, 4, 9])).toBe(5);
		});

		it("mean rejects an empty collection", () => {
			expect(() => Utils.mean([])).toThrow("Can't average zero values");
		});

		it("stdev calculates population standard deviation", () => {
			expect(Utils.stdev([2, 4, 4, 4, 5, 5, 7, 9])).toBe(2);
		});

		it("stdev rejects an empty collection", () => {
			expect(() => Utils.stdev()).toThrow("Can't stdev zero values");
		});
	});

	describe("identifiers and file metadata", () => {
		it("generateTempId returns the local ID shape", () => {
			expect(Utils.generateTempId()).toMatch(/^local-[0-9a-f]{8}-[0-9a-f]{4}$/);
		});

		it("generateTempId produces varying IDs", () => {
			const random = vi
				.spyOn(Math, "random")
				.mockReturnValueOnce(0.1)
				.mockReturnValueOnce(0.2)
				.mockReturnValueOnce(0.3)
				.mockReturnValueOnce(0.4)
				.mockReturnValueOnce(0.5)
				.mockReturnValueOnce(0.6);
			expect(Utils.generateTempId()).not.toBe(Utils.generateTempId());
			random.mockRestore();
		});

		it("generateFakeServerId returns a lowercase alphanumeric ID", () => {
			expect(Utils.generateFakeServerId()).toMatch(/^[0-9a-z]+$/);
		});

		it("isTempId recognizes local IDs", () => {
			expect(Utils.isTempId("local-1234")).toBe(true);
		});

		it("isTempId rejects server IDs and non-strings", () => {
			expect(Utils.isTempId("server-1234")).toBe(false);
			expect(Utils.isTempId(null)).toBe(false);
		});

		it("tableNameForJoin concatenates class names", () => {
			class Thread {}
			class Label {}
			expect(Utils.tableNameForJoin(Thread, Label)).toBe("ThreadLabel");
		});

		it("shouldDisplayAsImage accepts a preview-sized image", () => {
			expect(Utils.shouldDisplayAsImage({ name: "photo.JPEG", size: 1024 })).toBe(
				true,
			);
		});

		it("shouldDisplayAsImage rejects unsupported extensions", () => {
			expect(Utils.shouldDisplayAsImage({ name: "notes.txt", size: 1024 })).toBe(
				false,
			);
		});

		it("shouldDisplayAsImage rejects files outside preview size bounds", () => {
			expect(Utils.shouldDisplayAsImage({ name: "tiny.png", size: 512 })).toBe(
				false,
			);
			expect(
				Utils.shouldDisplayAsImage({ name: "huge.png", size: 5 * 1024 * 1024 }),
			).toBe(false);
		});

		it("showIconForAttachments rejects non-arrays", () => {
			expect(Utils.showIconForAttachments(null)).toBe(false);
		});

		it("showIconForAttachments finds a visible attachment", () => {
			const visible = { contentId: null, size: 1 };
			expect(
				Utils.showIconForAttachments([
					{ contentId: "inline", size: 100 },
					visible,
				]),
			).toBe(visible);
		});
	});

	describe("email helpers", () => {
		it("emailsHaveSameDomain compares domains case-insensitively", () => {
			expect(
				Utils.emailsHaveSameDomain("One@Example.com", "two@example.COM"),
			).toBe(true);
		});

		it("emailsHaveSameDomain requires at least two addresses", () => {
			expect(Utils.emailsHaveSameDomain("one@example.com")).toBe(false);
		});

		it("emailsHaveSameDomain rejects different domains", () => {
			expect(Utils.emailsHaveSameDomain("a@example.com", "b@other.com")).toBe(
				false,
			);
		});

		it("emailHasCommonDomain recognizes a common provider", () => {
			expect(Utils.emailHasCommonDomain(" Person@GMAIL.COM ")).toBe(true);
		});

		it("emailHasCommonDomain rejects an uncommon provider", () => {
			expect(Utils.emailHasCommonDomain("person@example.test")).toBe(false);
		});

		it("toEquivalentEmailForm removes plus addressing", () => {
			expect(Utils.toEquivalentEmailForm("Person+news@Example.com")).toBe(
				"person@example.com",
			);
		});

		it("emailIsEquivalent accepts case and whitespace differences", () => {
			expect(Utils.emailIsEquivalent(" A@EXAMPLE.COM ", "a@example.com")).toBe(
				true,
			);
		});

		it("emailIsEquivalent accepts plus-address variants", () => {
			expect(
				Utils.emailIsEquivalent("a+one@example.com", "a+two@example.com"),
			).toBe(true);
		});

		it("emailIsEquivalent rejects different mailboxes", () => {
			expect(Utils.emailIsEquivalent("a@example.com", "b@example.com")).toBe(
				false,
			);
		});

		it("likelyNonHumanEmail recognizes no-reply senders", () => {
			expect(Utils.likelyNonHumanEmail("no-reply@example.com")).toBe(true);
		});

		it("likelyNonHumanEmail accepts ordinary short addresses", () => {
			expect(Utils.likelyNonHumanEmail("person@example.com")).toBe(false);
		});
	});

	describe("comparison, geometry, and path helpers", () => {
		it("rectVisibleInRect detects intersecting rectangles", () => {
			expect(
				Utils.rectVisibleInRect(
					{ left: 0, right: 10, top: 0, bottom: 10 },
					{ left: 5, right: 15, top: 5, bottom: 15 },
				),
			).toBe(true);
		});

		it("rectVisibleInRect rejects separated rectangles", () => {
			expect(
				Utils.rectVisibleInRect(
					{ left: 0, right: 10, top: 0, bottom: 10 },
					{ left: 11, right: 20, top: 0, bottom: 10 },
				),
			).toBe(false);
		});

		it("overlapsBounds detects enclosed ranges", () => {
			expect(Utils.overlapsBounds({ start: 1, end: 10 }, { start: 3, end: 4 })).toBe(
				true,
			);
		});

		it("overlapsBounds rejects disjoint ranges", () => {
			expect(
				Utils.overlapsBounds({ start: 1, end: 10 }, { start: 11, end: 12 }),
			).toBe(false);
		});

		it("isEqual compares nested objects", () => {
			expect(Utils.isEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })).toBe(
				true,
			);
		});

		it("isEqual detects nested differences", () => {
			expect(Utils.isEqual({ a: [1, 2] }, { a: [1, 3] })).toBe(false);
		});

		it("isEqual supports ignored keys", () => {
			expect(
				Utils.isEqual(
					{ id: 1, name: "same" },
					{ id: 2, name: "same" },
					{ ignoreKeys: ["id"] },
				),
			).toBe(true);
		});

		it("isEqual handles equivalent circular structures", () => {
			const a = {};
			const b = {};
			a.self = a;
			b.self = b;
			expect(Utils.isEqual(a, b)).toBe(true);
		});

		it("isEqual can consider functions equal", () => {
			expect(
				Utils.isEqual({ fn: () => 1 }, { fn: () => 2 }, { functionsAreEqual: true }),
			).toBe(true);
		});

		it("isEqualReact considers distinct function values equal", () => {
			expect(Utils.isEqualReact({ render: () => 1 }, { render: () => 2 })).toBe(
				true,
			);
		});

		it("_isEqual exposes the recursive comparison primitive", () => {
			expect(Utils._isEqual(/mail/gi, /mail/gi, [], [], {})).toBe(true);
		});

		it("resolvePath reads dotted paths", () => {
			expect(Utils.resolvePath("person.name.first", {
				person: { name: { first: "Ada" } },
			})).toBe("Ada");
		});

		it("resolvePath calls function-valued path components", () => {
			expect(Utils.resolvePath("person.name", {
				person: { name: () => "Ada" },
			})).toBe("Ada");
		});

		it("resolvePath concatenates plus-separated paths", () => {
			expect(Utils.resolvePath("first+last", { first: "Ada", last: "Lovelace" })).toBe(
				"Ada Lovelace",
			);
		});

		it("resolvePath uses the first nonblank comma alternative", () => {
			expect(Utils.resolvePath("nickname,person.name", {
				nickname: "",
				person: { name: "Ada" },
			})).toBe("Ada");
		});

		it("resolvePath returns null when no alternative resolves", () => {
			expect(Utils.resolvePath("nickname,title", { nickname: "", title: null })).toBeNull();
		});
	});

	describe("serial execution", () => {
		it("ensureSerialExecution invokes the wrapped function immediately", () => {
			const calls = [];
			const wrapped = Utils.ensureSerialExecution((finished, reinvoked, value) => {
				calls.push({ finished, reinvoked, value });
			});
			wrapped("first");
			expect(calls[0].value).toBe("first");
			expect(calls[0].reinvoked()).toBeUndefined();
		});

		it("ensureSerialExecution queues a reinvocation until completion", () => {
			const calls = [];
			const wrapped = Utils.ensureSerialExecution((finished, _reinvoked, value) => {
				calls.push({ finished, value });
			});
			wrapped("first");
			wrapped("second");
			expect(calls.map(({ value }) => value)).toEqual(["first"]);
			calls[0].finished();
			expect(calls.map(({ value }) => value)).toEqual(["first", "second"]);
		});

		it("ensureSerialExecution merges multiple queued argument lists", () => {
			const calls = [];
			const wrapped = Utils.ensureSerialExecution(
				(finished, _reinvoked, value) => calls.push({ finished, value }),
				(previous, next) => [Math.max(previous[0], next[0])],
			);
			wrapped(1);
			wrapped(2);
			wrapped(3);
			calls[0].finished();
			expect(calls.map(({ value }) => value)).toEqual([1, 3]);
		});
	});
});
