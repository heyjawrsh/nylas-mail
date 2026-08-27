import { describe, expect, it, vi } from "vitest";
import registerLoggerDecorator from "../src/decorators/logger";
import registerErrorFormatDecorator from "../src/decorators/error-format";

describe("decorators", () => {
	it("registers an applied request logger", () => {
		const decorate = vi.fn();
		registerLoggerDecorator({ decorate });
		expect(decorate).toHaveBeenCalledWith(
			"request",
			"logger",
			expect.any(Function),
			{ apply: true },
		);
	});
	it("builds a contextual logger and supports account scoping", () => {
		let factory;
		registerLoggerDecorator({
			decorate: (_type, _name, fn) => {
				factory = fn;
			},
		});
		const child = {};
		global.Logger = {
			child: vi.fn(() => child),
			forAccount: vi.fn(() => "scoped"),
		};
		const request = {
			method: "get",
			info: { remoteAddress: "127.0.0.1", remotePort: 42 },
			url: { pathname: "/x", path: "/x?q=1" },
			headers: {},
			id: "id",
		};
		expect(factory.call(request)).toBe(child);
		expect(child.forAccount({ id: "a" })).toBe("scoped");
		expect(global.Logger.child).toHaveBeenCalledWith(
			expect.objectContaining({ http_method: "GET", request_uid: "id" }),
		);
	});
	it("reformats Boom responses before continuing", () => {
		let extension;
		registerErrorFormatDecorator({
			ext: (_name, fn) => {
				extension = fn;
			},
		});
		const reformat = vi.fn();
		const h = { continue: Symbol("continue") };
		expect(extension({ response: { isBoom: true, reformat } }, h)).toBe(
			h.continue,
		);
		expect(reformat).toHaveBeenCalled();
		expect(extension({ response: {} }, h)).toBe(h.continue);
	});
});
