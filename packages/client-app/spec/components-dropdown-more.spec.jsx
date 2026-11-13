import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("nylas-component-kit", () => ({
	default: {},
	Menu: ({ items = [], itemContent, onSelect, onEscape }) => (
		<div className="menu">
			{items.map((item) => (
				<button key={item.id} onClick={() => onSelect(item)}>
					{itemContent(item)}
				</button>
			))}
			<button onClick={onEscape}>Escape menu</button>
		</div>
	),
}));

vi.mock("../src/components/date-picker.jsx", () => ({
	default: ({ onChange, ...props }) => (
		<input data-testid="date-picker" onChange={(event) => onChange(event.target.value)} {...props} />
	),
}));

vi.mock("../src/components/tab-group-region.jsx", () => ({
	default: ({ children }) => <section data-testid="tab-group">{children}</section>,
}));

vi.mock("../src/components/retina-img.jsx", () => ({
	default: Object.assign(
		(props) => <i data-testid="retina-img" data-name={props.name} />,
		{ Mode: { ContentIsMask: "mask" } },
	),
}));

import ButtonDropdown from "../src/components/button-dropdown.jsx";
import DropdownMenu from "../src/components/dropdown-menu.jsx";
import GeneratedFormInterop from "../src/components/generated-form.jsx";
import KeyCommandsRegion from "../src/components/key-commands-region.jsx";
import ResizableRegion from "../src/components/resizable-region.jsx";
import TimePicker from "../src/components/time-picker.jsx";

const { FormItem, GeneratedFieldset, GeneratedForm } = GeneratedFormInterop;

afterEach(cleanup);

beforeEach(() => {
	vi.clearAllMocks();
	globalThis.NylasEnv.commands.add = vi.fn(() => ({ dispose: vi.fn() }));
	globalThis.NylasEnv.menu.add = vi.fn(() => ({ dispose: vi.fn() }));
});

describe("DropdownMenu deeper behavior", () => {
	const inbox = { id: "inbox", label: "Inbox" };
	const archive = { id: "archive", label: "Archive" };
	const props = {
		intitialSelectionItem: inbox,
		items: [archive],
		itemContent: (item) => <span>{item.label}</span>,
	};

	it("selects an item, notifies the caller, and closes", () => {
		const onSelect = vi.fn();
		const { container } = render(<DropdownMenu {...props} onSelect={onSelect} />);
		fireEvent.click(screen.getByText("Inbox"));
		fireEvent.click(screen.getByText("Archive"));
		expect(onSelect).toHaveBeenCalledWith(archive);
		expect(screen.getByText("Archive")).toBeDefined();
		expect(container.querySelector(".menu")).toBeNull();
	});

	it("closes an expanded menu on escape", () => {
		const { container } = render(<DropdownMenu {...props} />);
		fireEvent.click(screen.getByText("Inbox"));
		fireEvent.click(screen.getByText("Escape menu"));
		expect(container.querySelector(".menu")).toBeNull();
	});


	it("stays open when focus moves to a descendant", () => {
		const { container } = render(<DropdownMenu {...props} />);
		fireEvent.click(screen.getByText("Inbox"));
		const menuButton = screen.getByText("Archive");
		fireEvent.blur(container.firstChild, { relatedTarget: menuButton });
		expect(container.querySelector(".menu")).not.toBeNull();
	});
});

describe("ButtonDropdown", () => {


	it("renders a single combined control without primaryClick", () => {
		const { container } = render(<ButtonDropdown primaryItem={<span>Actions</span>} menu={<span>Archive</span>} />);
		expect(container.querySelector(".only-item")).not.toBeNull();
		expect(container.querySelector(".secondary-items.left")).not.toBeNull();
	});

	it("closes after a menu press when configured", () => {
		const { container } = render(
			<ButtonDropdown closeOnMenuClick primaryItem={<span>Actions</span>} menu={<span>Archive</span>} />,
		);
		fireEvent.click(screen.getByText("Actions"));
		expect(container.firstChild.className).toContain("open-down");
		fireEvent.mouseDown(screen.getByText("Archive"));
		expect(container.firstChild.className).not.toContain("open-down");
	});
});

describe("Generated form components through CommonJS default interop", () => {
	it("renders text, textarea, select, hidden, and empty-space field types", () => {
		const onChange = vi.fn();
		const { container } = render(
			<div>
				<FormItem id="text" type="text" label="Name" value="Ada" onChange={onChange} />
				<FormItem id="notes" type="textarea" label="Notes" value="Hello" onChange={onChange} />
				<FormItem id="choice" type="select" label="Choice" value="b" selectOptions={[{ value: "b", label: "Beta" }]} onChange={onChange} />
				<FormItem id="secret" type="hidden" value="x" onChange={onChange} />
				<FormItem id="space" type="EmptySpace" label="Space" onChange={onChange} />
			</div>,
		);
		expect(screen.getByDisplayValue("Ada")).toBeDefined();
		expect(screen.getByDisplayValue("Hello").tagName).toBe("TEXTAREA");
		expect(screen.getByText("Beta")).toBeDefined();
		expect(container.querySelector('input[type="hidden"]')).not.toBeNull();
		expect(container.querySelector(".empty-space")).not.toBeNull();
	});

	it("reports an input change with its field id", () => {
		const onChange = vi.fn();
		render(<FormItem id="email" type="email" label="Email" value="a@example.com" onChange={onChange} />);
		fireEvent.change(screen.getByDisplayValue("a@example.com"), { target: { value: "b@example.com" } });
		expect(onChange).toHaveBeenCalledWith("email", "b@example.com");
	});

	it("marks required invalid fields and renders their error", () => {
		const { container } = render(
			<FormItem id="name" type="text" label="Name" required onChange={() => {}} formItemError={{ id: "name", message: "Name is required" }} />,
		);
		expect(container.querySelector(".form-item").className).toContain("invalid");
		expect(container.querySelector(".required").textContent).toBe("*");
		expect(screen.getByText("Name is required")).toBeDefined();
	});

	it("disables fields according to the form operation", () => {
		render(<FormItem id="immutable" type="text" label="ID" formType="update" editableForUpdate={false} onChange={() => {}} />);
		expect(screen.getByLabelText("ID").disabled).toBe(true);
	});

	it("groups fieldset items by rows and columns and hides all-hidden rows", () => {
		const { container } = render(
			<GeneratedFieldset id="profile" useHeading heading="Profile" onChange={() => {}} formItems={[
				{ id: "first", type: "text", label: "First", row: 1, column: 1 },
				{ id: "last", type: "text", label: "Last", row: 1, column: 2 },
				{ id: "token", type: "hidden", row: 2, column: 1 },
			]} />,
		);
		expect(screen.getByText("Profile").tagName).toBe("LEGEND");
		expect(container.querySelectorAll('.row[data-row-num="1"] .column')).toHaveLength(2);
		expect(container.querySelector('.row[data-row-num="2"]').style.display).toBe("none");
	});

	it("returns cloned fieldset data when a child changes", () => {
		const onChange = vi.fn();
		const formItems = [{ id: "name", name: "name", type: "text", label: "Name", value: "Old", row: 1, column: 1 }];
		render(<GeneratedFieldset id="profile" formItems={formItems} onChange={onChange} />);
		fireEvent.change(screen.getByDisplayValue("Old"), { target: { value: "New" } });
		expect(onChange).toHaveBeenCalledWith("profile", [{ ...formItems[0], value: "New" }]);
		expect(formItems[0].value).toBe("Old");
	});

	it("renders create affordances, prefilled copy, and submits by click or shortcut", () => {
		const onSubmit = vi.fn();
		const { container } = render(<GeneratedForm formType="new" prefilled fieldsets={[]} onChange={() => {}} onSubmit={onSubmit} />);
		expect(screen.getByText(/fields have been prefilled/)).toBeDefined();
		fireEvent.click(screen.getByText("Create"));
		fireEvent.keyDown(container.querySelector("form"), { key: "Enter", ctrlKey: true });
		expect(onSubmit).toHaveBeenCalledTimes(2);
	});

});

describe("KeyCommandsRegion", () => {
	it("renders caller content, classes, and ordinary DOM props", () => {
		render(<KeyCommandsRegion className="composer" data-testid="keys">Body</KeyCommandsRegion>);
		const region = screen.getByTestId("keys");
		expect(region.className).toContain("key-commands-region");
		expect(region.className).toContain("composer");
		expect(region.textContent).toBe("Body");
	});

	it("registers global handlers on the body", () => {
		const handlers = { "core:cancel": vi.fn() };
		render(<KeyCommandsRegion globalHandlers={handlers}>Body</KeyCommandsRegion>);
		expect(NylasEnv.commands.add).toHaveBeenCalledWith(document.body, handlers);
	});

	it("registers local handlers on its own node", () => {
		const handlers = { "core:confirm": vi.fn() };
		const { container } = render(<KeyCommandsRegion localHandlers={handlers}>Body</KeyCommandsRegion>);
		expect(NylasEnv.commands.add).toHaveBeenCalledWith(container.firstChild, handlers);
	});

	it("adds and disposes global menu items", () => {
		const dispose = vi.fn();
		NylasEnv.menu.add.mockReturnValue({ dispose });
		const items = [{ label: "Reply" }];
		const view = render(<KeyCommandsRegion globalMenuItems={items}>Body</KeyCommandsRegion>);
		expect(NylasEnv.menu.add).toHaveBeenCalledWith(items);
		view.unmount();
		expect(dispose).toHaveBeenCalledOnce();
	});

	it("reports focus entering and applies focused state", () => {
		const onFocusIn = vi.fn();
		const { container } = render(<KeyCommandsRegion onFocusIn={onFocusIn}><input aria-label="editor" /></KeyCommandsRegion>);
		fireEvent.focusIn(screen.getByLabelText("editor"));
		expect(onFocusIn).toHaveBeenCalledOnce();
		expect(container.firstChild.className).toContain("focused");
	});
});

describe("ResizableRegion through CommonJS default interop", () => {
	it("clamps right-handle width between configured bounds", () => {
		const state = { bcr: { left: 100 } };
		expect(ResizableRegion.Handle.Right.transform(state, { minWidth: 80, maxWidth: 200 }, { pageX: 120 })).toEqual({ width: 80 });
		expect(ResizableRegion.Handle.Right.transform(state, { minWidth: 80, maxWidth: 200 }, { pageX: 400 })).toEqual({ width: 200 });
	});

	it("calculates left-handle width from the opposite edge", () => {
		expect(ResizableRegion.Handle.Left.transform({ bcr: { right: 500 } }, {}, { pageX: 320 })).toEqual({ width: 180 });
	});

	it("clamps top and bottom handle heights", () => {
		const props = { minHeight: 50, maxHeight: 150 };
		expect(ResizableRegion.Handle.Top.transform({ bcr: { bottom: 300 } }, props, { pageY: 100 })).toEqual({ height: 150 });
		expect(ResizableRegion.Handle.Bottom.transform({ bcr: { top: 100 } }, props, { pageY: 120 })).toEqual({ height: 50 });
	});

	it("renders a horizontal region with initial dimensions and passthrough props", () => {
		const { container } = render(<ResizableRegion handle={ResizableRegion.Handle.Right} initialWidth={180} minWidth={100} data-testid="region">List</ResizableRegion>);
		const region = screen.getByTestId("region");
		expect(region.style.width).toBe("180px");
		expect(region.style.minWidth).toBe("100px");
		expect(container.querySelector(".flexbox-handle-right")).not.toBeNull();
	});

	it("uses flexible vertical sizing when no initial height is supplied", () => {
		render(<ResizableRegion handle={ResizableRegion.Handle.Bottom} data-testid="region">Tray</ResizableRegion>);
		const region = screen.getByTestId("region");
		expect(region.style.flex).toBe("1 1 0%");
		expect(region.style.width).toBe("100%");
	});
});

describe("TimePicker", () => {
	const noon = new Date(2020, 0, 2, 12, 0).valueOf();

	it("formats its value for the editable input", () => {
		render(<TimePicker value={noon} />);
		expect(screen.getByRole("textbox").value).toMatch(/12:00/);
	});

	it("marks invalid raw text and does not save it on blur", () => {
		const onChange = vi.fn();
		render(<TimePicker value={noon} onChange={onChange} />);
		const input = screen.getByRole("textbox");
		fireEvent.change(input, { target: { value: "not a time" } });
		expect(input.className).toContain("invalid");
		fireEvent.blur(input);
		expect(onChange).not.toHaveBeenCalled();
	});

	it("interprets a small bare hour as afternoon", () => {
		const onChange = vi.fn();
		render(<TimePicker value={noon} onChange={onChange} />);
		const input = screen.getByRole("textbox");
		fireEvent.change(input, { target: { value: "2" } });
		fireEvent.blur(input);
		expect(new Date(onChange.mock.calls[0][0]).getHours()).toBe(14);
	});

	it("shows half-hour options while focused and selects one", () => {
		const onChange = vi.fn();
		const { container } = render(<TimePicker value={noon} onChange={onChange} />);
		fireEvent.focus(screen.getByRole("textbox"));
		expect(container.querySelectorAll(".time-options .option").length).toBeGreaterThan(40);
		fireEvent.mouseDown(container.querySelector(".time-options .option"));
		expect(onChange).toHaveBeenCalledOnce();
	});

	it("moves down by one rounded half-hour without crossing days", () => {
		const onChange = vi.fn();
		render(<TimePicker value={new Date(2020, 0, 2, 12, 10).valueOf()} onChange={onChange} />);
		fireEvent.keyDown(screen.getByRole("textbox"), { key: "ArrowDown" });
		expect(onChange.mock.calls[0][0].format("HH:mm")).toBe("12:30");
	});
});
