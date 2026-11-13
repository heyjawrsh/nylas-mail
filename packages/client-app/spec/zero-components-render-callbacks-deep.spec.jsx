import React, { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/react";

const m = vi.hoisted(() => {
	const existsSync = vi.fn(() => true);
	const previewFile = vi.fn();
	const dispose = vi.fn();
	const perspectiveListen = vi.fn(() => vi.fn());
	const applyCategoryToThreads = vi.fn();
	const removeCategoryFromThreads = vi.fn();
	const categoryFor = vi.fn();
	const accountForId = vi.fn((id) => ({ id }));
	const currentPerspective = vi.fn(() => ({ accountIds: ["a1", "a2"] }));
	const shiftFocus = vi.fn();
	const isEmptyBoundingRect = vi.fn(() => false);
	const isEqualReact = vi.fn((a, b) => a === b);
	return {
		existsSync, previewFile, dispose, perspectiveListen, applyCategoryToThreads,
		removeCategoryFromThreads, categoryFor, accountForId, currentPerspective,
		shiftFocus, isEmptyBoundingRect, isEqualReact,
	};
});

vi.mock("react", async (importOriginal) => {
	const actual = await importOriginal();
	return { default: actual, ...actual };
});
vi.mock("prop-types", () => {
	const checker = () => checker;
	checker.isRequired = checker;
	const types = new Proxy({}, { get: () => checker });
	return { default: types, ...types };
});
vi.mock("underscore", () => {
	const underscore = {
		extend: Object.assign,
		clone: (value) => ({ ...value }),
		findWhere: (values, attrs) => values.find((value) => Object.entries(attrs).every(([key, expected]) => value[key] === expected)),
		map: (value, fn) => Object.entries(value || {}).map(([key, item]) => fn(item, key)),
		isFunction: (value) => typeof value === "function",
		isEqual: (a, b) => JSON.stringify(a) === JSON.stringify(b),
	};
	return { default: underscore, ...underscore };
});
vi.mock("classnames", () => {
	const classnames = (...values) => values.flatMap((value) => typeof value === "string" ? [value] : Object.keys(value || {}).filter((key) => value[key])).join(" ");
	return { default: classnames, classnames };
});
vi.mock("node:fs", () => ({ default: { existsSync: m.existsSync }, existsSync: m.existsSync }));
vi.mock("node:path", () => ({ default: { basename: (value) => value.split("/").at(-1) }, basename: (value) => value.split("/").at(-1) }));
vi.mock("pick-react-known-prop", () => {
	const pickHTMLProps = (props) => Object.fromEntries(Object.entries(props).filter(([key]) => key.startsWith("data-") || key === "title"));
	return { default: { pickHTMLProps }, pickHTMLProps };
});
vi.mock("rx-lite", () => {
	class Observable { subscribe() {} }
	return { default: { Observable }, Observable };
});
vi.mock("moment", async () => {
	const actual = await import("moment-timezone");
	return { default: actual.default, ...actual };
});
vi.mock("electron", () => {
	const remote = { app: { quit: vi.fn() } };
	return { default: { remote }, remote };
});
vi.mock("@electron/remote", () => {
	const remote = { app: { quit: vi.fn() } };
	return { default: remote, ...remote, remote };
});

vi.mock("../src/components/retina-img.jsx", () => {
	const RetinaImg = React.forwardRef(({ name, className, onClick }, ref) => <button ref={ref} type="button" data-testid={name} className={className} onClick={onClick}>{name}</button>);
	RetinaImg.Mode = { ContentPreserve: "preserve", ContentIsMask: "mask" };
	return { default: RetinaImg };
});
vi.mock("../src/components/flexbox.jsx", () => ({ default: ({ children, className }) => <div className={className} data-testid="flexbox">{children}</div> }));
vi.mock("../src/components/spinner.jsx", () => ({ default: ({ visible }) => visible ? <div data-testid="spinner" /> : null }));
vi.mock("nylas-exports", () => {
	const Actions = { applyCategoryToThreads: m.applyCategoryToThreads, removeCategoryFromThreads: m.removeCategoryFromThreads };
	const CategoryStore = { getStandardCategory: m.categoryFor };
	const FocusedPerspectiveStore = { current: m.currentPerspective, listen: m.perspectiveListen };
	const AccountStore = { accountForId: m.accountForId };
	const DateUtils = { DATE_FORMAT_llll_NO_TIME: "ddd, MMM D YYYY" };
	const exports = { Actions, Utils: {}, Thread: {}, TaskFactory: {}, CategoryStore, FocusedPerspectiveStore, AccountStore, DateUtils };
	return { default: exports, ...exports };
});
vi.mock("nylas-component-kit", () => {
	const MiniMonthView = ({ onChange, value }) => <button type="button" data-testid="mini-month" onClick={() => onChange(value.valueOf() + 86400000)}>month</button>;
	return { default: { MiniMonthView }, MiniMonthView };
});

globalThis.NylasEnv = {
	isWorkWindow: vi.fn(() => true), inSpecMode: vi.fn(() => true), inDevMode: vi.fn(() => false), reportError: vi.fn(),
	config: { get: vi.fn(() => null), onDidChange: vi.fn(() => ({ dispose: m.dispose })) },
	getConfigDirPath: vi.fn(() => "/config"), getPath: vi.fn(() => "/tmp"), getVersion: vi.fn(() => "0.0.0"),
	getCurrentWindow: vi.fn(() => ({ previewFile: m.previewFile })),
};
globalThis.Utils = { isEqualReact: m.isEqualReact };
globalThis.DOMUtils = { isEmptyBoundingRect: m.isEmptyBoundingRect };
globalThis.Flexbox = ({ children, className }) => <div className={className}>{children}</div>;
globalThis.Template = { Type: { Enum: "Enum", String: "String", None: "None" } };

const { default: FloatingToolbar } = await import("../src/components/contenteditable/floating-toolbar.jsx");
const { AttachmentItem, ImageAttachmentItem } = await import("../src/components/attachment-items.jsx");
const { default: ScenarioEditorRow } = await import("../src/components/scenario-editor-row.jsx");
const { default: MailImportantIcon } = await import("../src/components/mail-important-icon.jsx");
const { default: DatePicker } = await import("../src/components/date-picker.jsx");

afterEach(cleanup);
beforeEach(() => {
	vi.clearAllMocks();
	m.existsSync.mockReturnValue(true);
	m.isEmptyBoundingRect.mockReturnValue(false);
	m.currentPerspective.mockReturnValue({ accountIds: ["a1", "a2"] });
	Object.defineProperty(window, "devicePixelRatio", { configurable: true, value: 2 });
});

describe("FloatingToolbar rendering and placement", () => {
	const Box = ({ label }) => <span>{label}</span>;
	Box.displayName = "Box";
	const rectNode = (rect) => ({ getBoundingClientRect: () => rect });
	const fixture = (config = {}) => {
		const ref = createRef();
		const locationRefNode = config.locationRefNode || rectNode({ left: 80, top: 80, width: 20, height: 10 });
		const editableNode = rectNode({ left: 10, top: 10, width: 300, height: 300 });
		const extension = { toolbarComponentConfig: vi.fn(() => ({ component: Box, props: { label: "Tools" }, locationRefNode, width: 100, height: 30, ...config })) };
		const view = render(<FloatingToolbar ref={ref} extensions={[extension]} />);
		act(() => ref.current.componentWillReceiveInnerProps({ editableNode }));
		return { ...view, ref, extension };
	};

	it("stays hidden without a configured component", () => { expect(render(<FloatingToolbar />).container.firstChild).toBeNull(); });
});

describe("Attachment item rendering and actions", () => {
	const props = (overrides = {}) => ({ displayName: "report.pdf", displaySize: "2 KB", filePath: "/tmp/report.pdf", contentType: "application/pdf", fileIconName: "pdf.png", ...overrides });
	it("shows a spinner for an image at the start of download", () => { expect(render(<ImageAttachmentItem {...props({ download: { state: "downloading", percent: 5 } })} />).getByTestId("spinner")).toBeDefined(); });
	it("adds download progress to a partial image URL", () => { const view = render(<ImageAttachmentItem {...props({ download: { state: "downloading", percent: 50 } })} />); expect(view.container.querySelector("img").getAttribute("src")).toBe("/tmp/report.pdf?percent=50"); });
});



describe("DatePicker display and keyboard callbacks", () => {
	const timestamp = new Date(2024, 4, 15, 12).valueOf();
	const fixture = (overrides = {}) => { const ref = createRef(); const onChange = vi.fn(); const view = render(<DatePicker ref={ref} value={timestamp} onChange={onChange} {...overrides} />); ref.current.context = { parentTabGroup: { shiftFocus: m.shiftFocus } }; return { ...view, ref, onChange }; };
	it("prompts for a date when its value is empty", () => { expect(render(<DatePicker />).getByText("Click to set date")).toBeDefined(); });
	it("formats a supplied date for display", () => { expect(fixture().container.querySelector(".day-text").textContent).toContain("2024"); });
	it("shows the mini month while focused", () => { const f = fixture(); fireEvent.focus(f.container.querySelector(".date-picker")); expect(f.getByTestId("mini-month")).toBeDefined(); });
	it("hides the mini month after blur", () => { const f = fixture(); const picker = f.container.querySelector(".date-picker"); fireEvent.focus(picker); fireEvent.blur(picker); expect(f.queryByTestId("mini-month")).toBeNull(); });
	it("moves one day left from the keyboard", () => { const f = fixture(); fireEvent.keyDown(f.container.querySelector(".date-picker"), { key: "ArrowLeft" }); expect(f.onChange).toHaveBeenCalledWith(timestamp - 86400000); });
	it("moves one week down from the keyboard", () => { const f = fixture(); fireEvent.keyDown(f.container.querySelector(".date-picker"), { key: "ArrowDown" }); expect(f.onChange).toHaveBeenCalledWith(timestamp + 7 * 86400000); });
	it("formats callback values with dateFormat", () => { const f = fixture({ dateFormat: "YYYY-MM-DD" }); fireEvent.keyDown(f.container.querySelector(".date-picker"), { key: "ArrowRight" }); expect(f.onChange).toHaveBeenCalledWith("2024-05-16"); });
	it("moves focus forward on Enter", () => { const f = fixture(); fireEvent.keyDown(f.container.querySelector(".date-picker"), { key: "Enter" }); expect(m.shiftFocus).toHaveBeenCalledWith(1); });
});
