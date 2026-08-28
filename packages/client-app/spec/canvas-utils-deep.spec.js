import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => {
	const remote = { app: { quit: vi.fn(), relaunch: vi.fn() } };
	const electron = { remote };
	const underscore = {
		isArray: Array.isArray,
		isNumber: (value) => typeof value === "number",
		isString: (value) => typeof value === "string",
	};
	return { electron, remote, underscore };
});

vi.mock("electron", () => ({ default: m.electron, ...m.electron }));
vi.mock("@electron/remote", () => ({ default: m.remote, ...m.remote, remote: m.remote }));
vi.mock("underscore", () => ({ default: m.underscore, ...m.underscore }));

globalThis.NylasEnv = {
	isWorkWindow: vi.fn(() => true),
	inSpecMode: vi.fn(() => true),
	inDevMode: vi.fn(() => false),
	reportError: vi.fn(),
	config: { get: vi.fn(() => null), onDidChange: vi.fn(() => ({ dispose: vi.fn() })) },
	getConfigDirPath: vi.fn(() => "/tmp"),
	getPath: vi.fn(() => "/tmp"),
	getVersion: vi.fn(() => "0.0.0"),
};

const callsFor = (context, name) => context.calls.filter((call) => call[0] === name);

const makeContext = () => {
	const context = {
		calls: [],
		beginPath() { this.calls.push(["beginPath"]); },
		moveTo(...args) { this.calls.push(["moveTo", ...args]); },
		lineTo(...args) { this.calls.push(["lineTo", ...args]); },
		quadraticCurveTo(...args) { this.calls.push(["quadraticCurveTo", ...args]); },
		closePath() { this.calls.push(["closePath"]); },
		stroke() { this.calls.push(["stroke"]); return "stroked"; },
		fill() { this.calls.push(["fill"]); return "filled"; },
		clearRect(...args) { this.calls.push(["clearRect", ...args]); },
		arc(...args) { this.calls.push(["arc", ...args]); },
		rotate(...args) { this.calls.push(["rotate", ...args]); },
		drawImage(...args) { this.calls.push(["drawImage", ...args]); },
		fillText(...args) { this.calls.push(["fillText", ...args]); },
		measureText(text) { this.calls.push(["measureText", text]); return { width: 12.2 }; },
		createLinearGradient(...args) {
			this.calls.push(["createLinearGradient", ...args]);
			const gradient = { stops: [], addColorStop(offset, color) { this.stops.push([offset, color]); } };
			context.gradient = gradient;
			return gradient;
		},
	};
	return context;
};

const contexts = new WeakMap();
const createdContexts = [];
vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (kind) {
	if (kind !== "2d") return null;
	if (!contexts.has(this)) {
		const context = makeContext();
		contexts.set(this, context);
		createdContexts.push(context);
	}
	return contexts.get(this);
});
let dataURLSequence = 0;
vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockImplementation(() => `data:image/png;spec-${++dataURLSequence}`);

const imported = await import("../src/canvas-utils.js");
const CanvasUtils = imported.default || imported;
const percentCanvas = () => [...document.body.querySelectorAll("canvas")].find((canvas) => canvas.style.width === "30px");

beforeEach(() => {
	for (const context of createdContexts) context.calls = [];
});

describe("CanvasUtils rounded rectangle drawing", () => {
	let context;

	beforeEach(() => { context = makeContext(); });

	it("begins and closes the rounded path", () => {
		CanvasUtils.roundRect(context, 10, 20, 30, 40, 4, false, false);
		expect(context.calls).toEqual(expect.arrayContaining([["beginPath"], ["closePath"]]));
	});

	it("starts the path one radius from the left edge", () => {
		CanvasUtils.roundRect(context, 10, 20, 30, 40, 4, false, false);
		expect(callsFor(context, "moveTo")[0]).toEqual(["moveTo", 14, 20]);
	});

	it("uses the default radius when it is omitted", () => {
		CanvasUtils.roundRect(context, 10, 20, 30, 40, undefined, false, false);
		expect(callsFor(context, "moveTo")[0]).toEqual(["moveTo", 15, 20]);
	});

	it("draws all four rounded corners", () => {
		CanvasUtils.roundRect(context, 10, 20, 30, 40, 4, false, false);
		expect(callsFor(context, "quadraticCurveTo")).toEqual([
			["quadraticCurveTo", 40, 20, 40, 24],
			["quadraticCurveTo", 40, 60, 36, 60],
			["quadraticCurveTo", 10, 60, 10, 56],
			["quadraticCurveTo", 10, 20, 14, 20],
		]);
	});

	it("strokes by default", () => {
		CanvasUtils.roundRect(context, 0, 0, 10, 10);
		expect(callsFor(context, "stroke")).toHaveLength(1);
	});

	it("does not stroke when stroke is false", () => {
		CanvasUtils.roundRect(context, 0, 0, 10, 10, 2, false, false);
		expect(callsFor(context, "stroke")).toHaveLength(0);
	});

	it("fills and returns the fill result when requested", () => {
		expect(CanvasUtils.roundRect(context, 0, 0, 10, 10, 2, true, false)).toBe("filled");
	});
});

describe("CanvasUtils percent-loaded image", () => {
	beforeEach(() => { Object.defineProperty(window, "devicePixelRatio", { configurable: true, value: 2 }); });

	it("sizes the bitmap for the device pixel ratio", () => {
		CanvasUtils.dataURIForLoadedPercent(11);
		const canvas = percentCanvas();
		expect([canvas.width, canvas.height]).toEqual([40, 40]);
	});

	it("keeps the percent indicator at its CSS size", () => {
		CanvasUtils.dataURIForLoadedPercent(16);
		const canvas = percentCanvas();
		expect([canvas.style.width, canvas.style.height]).toEqual(["30px", "30px"]);
	});

	it("clears the scaled bitmap before drawing", () => {
		CanvasUtils.dataURIForLoadedPercent(21);
		const context = contexts.get(percentCanvas());
		expect(callsFor(context, "clearRect").at(-1)).toEqual(["clearRect", 0, 0, 40, 40]);
	});

	it("rounds progress down to a five-percent boundary", () => {
		CanvasUtils.dataURIForLoadedPercent(27);
		const context = contexts.get(percentCanvas());
		const arc = callsFor(context, "arc").at(-1);
		expect(arc).toEqual(["arc", 20, 20, 14, -Math.PI / 2, -Math.PI / 2 + Math.PI / 2]);
	});

	it("configures the progress stroke", () => {
		CanvasUtils.dataURIForLoadedPercent(31);
		const context = contexts.get(percentCanvas());
		expect([context.strokeStyle, context.lineWidth]).toEqual(["#AAA", 6]);
	});

	it("returns a canvas data URI", () => {
		expect(CanvasUtils.dataURIForLoadedPercent(36)).toMatch(/^data:image\/png;spec-/);
	});

	it("reuses the cached URI for percentages in the same bucket", () => {
		const first = CanvasUtils.dataURIForLoadedPercent(41);
		const second = CanvasUtils.dataURIForLoadedPercent(44);
		expect(second).toBe(first);
	});
});

describe("CanvasUtils thread drag image", () => {
	beforeEach(() => { Object.defineProperty(window, "devicePixelRatio", { configurable: true, value: 2 }); });

	it("returns a retina-sized drag canvas", () => {
		const canvas = CanvasUtils.canvasWithThreadDragImage(1);
		expect([canvas.width, canvas.height, canvas.style.width, canvas.style.height]).toEqual([116, 110, "58px", "55px"]);
	});

	it("draws one mail image for a single thread", () => {
		const canvas = CanvasUtils.canvasWithThreadDragImage(1);
		expect(callsFor(contexts.get(canvas), "drawImage").map((call) => call.slice(2))).toEqual([[0, 0, 96, 96]]);
	});

	it("draws a rotated background mail for multiple threads", () => {
		const canvas = CanvasUtils.canvasWithThreadDragImage(2);
		const context = contexts.get(canvas);
		expect(callsFor(context, "rotate").slice(-2)).toEqual([["rotate", -Math.PI / 9], ["rotate", Math.PI / 9]]);
	});

	it("builds the count bubble gradient", () => {
		const canvas = CanvasUtils.canvasWithThreadDragImage(3);
		expect(contexts.get(canvas).gradient.stops).toEqual([[0, "rgb(116, 124, 143)"], [1, "rgb(67, 77, 104)"]]);
	});

	it("draws a narrow bubble for a one-digit count", () => {
		const canvas = CanvasUtils.canvasWithThreadDragImage(9);
		expect(callsFor(contexts.get(canvas), "moveTo").at(-1)).toEqual(["moveTo", 96, 2]);
	});

	it("draws a wider bubble for a two-digit count", () => {
		const canvas = CanvasUtils.canvasWithThreadDragImage(10);
		expect(callsFor(contexts.get(canvas), "moveTo").at(-1)).toEqual(["moveTo", 88, 2]);
	});

	it("caps a three-digit count at 99 plus", () => {
		const canvas = CanvasUtils.canvasWithThreadDragImage(100);
		expect(callsFor(contexts.get(canvas), "fillText").at(-1)).toEqual(["fillText", "99+", 92, 24, 60]);
	});

	it("uses centered white count text", () => {
		const context = contexts.get(CanvasUtils.canvasWithThreadDragImage(7));
		expect([context.fillStyle, context.font, context.textAlign]).toEqual(["rgba(255,255,255,0.9)", "22px sans-serif", "center"]);
	});
});

describe("CanvasUtils text measurement and tray icon", () => {
	it("rounds measured text width up to a whole pixel", () => {
		expect(CanvasUtils.measureTextInCanvas("Inbox", "14px sans-serif")).toBe(13);
	});

	it("measures text with the requested font", () => {
		CanvasUtils.measureTextInCanvas("Inbox", "14px serif");
		const context = createdContexts.at(-1);
		expect([context.font, callsFor(context, "measureText")]).toEqual(["14px serif", [["measureText", "Inbox"]]]);
	});

	it("adds measured text width and padding to a tray icon", () => {
		const canvas = CanvasUtils.canvasWithSystemTrayIconAndText({ width: 20, height: 16 }, "7");
		expect([canvas.width, canvas.height]).toEqual([35, 16]);
	});

	it("does not add width for empty tray text", () => {
		const canvas = CanvasUtils.canvasWithSystemTrayIconAndText({ width: 20, height: 16 }, "");
		expect([canvas.width, canvas.height]).toEqual([20, 16]);
	});

	it("draws the tray image at the origin", () => {
		const image = { width: 20, height: 16 };
		const canvas = CanvasUtils.canvasWithSystemTrayIconAndText(image, "7");
		expect(callsFor(contexts.get(canvas), "drawImage").at(-1)).toEqual(["drawImage", image, 0, 0]);
	});

	it("vertically centers text after the tray image", () => {
		const canvas = CanvasUtils.canvasWithSystemTrayIconAndText({ width: 20, height: 16 }, "7");
		expect(callsFor(contexts.get(canvas), "fillText").at(-1)).toEqual(["fillText", "7", 20, 8]);
	});

	it("configures tray text styling", () => {
		const context = contexts.get(CanvasUtils.canvasWithSystemTrayIconAndText({ width: 20, height: 16 }, "7"));
		expect([context.font, context.fillStyle, context.textAlign, context.textBaseline]).toEqual([
			"26px Nylas-Pro, sans-serif", "black", "start", "middle",
		]);
	});
});
