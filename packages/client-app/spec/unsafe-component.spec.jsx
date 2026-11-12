import React from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ createRoot: null }));

vi.mock("nylas-exports", () => {
	const Utils = {
		isEqualReact: (a, b) => {
			const ka = Object.keys(a || {});
			const kb = Object.keys(b || {});
			return ka.length === kb.length && ka.every((k) => a[k] === b[k]);
		},
		fastOmit: (object, keys) =>
			Object.fromEntries(
				Object.entries(object).filter(([key]) => !keys.includes(key)),
			),
	};
	return { default: { Utils }, Utils };
});
vi.mock("react-dom/client", async () => {
	const actual = await vi.importActual("react-dom/client");
	m.createRoot = vi.fn((...args) => actual.createRoot(...args));
	return { ...actual, default: { ...actual, createRoot: m.createRoot }, createRoot: m.createRoot };
});

import { Utils } from "nylas-exports";
import UnsafeComponent from "../src/components/unsafe-component.jsx";

class Plugin extends React.Component {
	static displayName = "Plugin";
	focus = vi.fn();
	blur = vi.fn();
	componentWillUnmount() {
		Plugin.unmounted += 1;
	}
	render() {
		return <span className="plugin">{this.props.label}</span>;
	}
}
Plugin.unmounted = 0;

class PlainPlugin extends React.Component {
	static displayName = "PlainPlugin";
	render() {
		return <input className="plain" />;
	}
}

function FnPlugin() {
	return <input className="fn" />;
}
FnPlugin.displayName = "FnPlugin";

const Broken = ({ broken }) => {
	if (broken) throw new Error("plugin exploded");
	return <span className="fixed">ok</span>;
};
Broken.displayName = "Broken";

const wrapper = () =>
	document.querySelector('div[name="unsafe-component-wrapper"]');

let consoleError;
beforeEach(() => {
	vi.clearAllMocks();
	Plugin.unmounted = 0;
	NylasEnv.inDevMode.mockReturnValue(false);
	consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(async () => {
	cleanup();
	await act(async () => {});
	consoleError.mockRestore();
});

describe("UnsafeComponent injection", () => {
	it("renders the injected component inside its wrapper", () => {
		render(<UnsafeComponent component={Plugin} label="hello" />);
		expect(wrapper().querySelector(".plugin").textContent).toBe("hello");
	});

	it("applies containerStyles to the wrapper", () => {
		const Styled = Object.assign(() => <b />, {
			displayName: "Styled",
			containerStyles: { order: 2 },
		});
		render(<UnsafeComponent component={Styled} />);
		expect(wrapper().style.order).toBe("2");
	});

	it("calls onComponentDidRender after the injected tree commits", () => {
		const seen = [];
		const onComponentDidRender = vi.fn(() => {
			seen.push(wrapper().querySelector(".plugin")?.textContent);
		});
		render(
			<UnsafeComponent
				component={Plugin}
				label="hi"
				onComponentDidRender={onComponentDidRender}
			/>,
		);
		expect(onComponentDidRender).toHaveBeenCalledOnce();
		expect(seen).toEqual(["hi"]);
	});

	it("keeps wrapper-only props off the injected component", () => {
		let received;
		const Spy = (props) => {
			received = props;
			return null;
		};
		render(
			<UnsafeComponent component={Spy} onComponentDidRender={() => {}} value={7} />,
		);
		expect(received).toEqual({ value: 7 });
	});

	it("sends focus and blur to the injected instance's own methods", () => {
		let unsafe;
		render(
			<UnsafeComponent
				ref={(value) => {
					unsafe = value;
				}}
				component={Plugin}
			/>,
		);
		expect(unsafe.injected).toBeInstanceOf(Plugin);
		unsafe.focus();
		unsafe.blur();
		expect(unsafe.injected.focus).toHaveBeenCalledOnce();
		expect(unsafe.injected.blur).toHaveBeenCalledOnce();
	});

	it("focuses a class component's DOM node when it has no focus method", () => {
		let unsafe;
		render(
			<UnsafeComponent
				ref={(value) => {
					unsafe = value;
				}}
				component={PlainPlugin}
			/>,
		);
		unsafe.focus();
		expect(document.activeElement).toBe(document.querySelector("input.plain"));
	});

	it("falls back to the wrapper for a function component", () => {
		let unsafe;
		render(
			<UnsafeComponent
				ref={(value) => {
					unsafe = value;
				}}
				component={FnPlugin}
			/>,
		);
		expect(unsafe.injected).toBeNull();
		const focus = vi.spyOn(wrapper(), "focus");
		unsafe.focus();
		expect(focus).toHaveBeenCalledOnce();
	});
});

describe("UnsafeComponent re-render", () => {
	it("re-renders into the same root", () => {
		const onComponentDidRender = vi.fn();
		const { rerender } = render(
			<UnsafeComponent
				component={Plugin}
				label="one"
				onComponentDidRender={onComponentDidRender}
			/>,
		);
		rerender(
			<UnsafeComponent
				component={Plugin}
				label="two"
				onComponentDidRender={onComponentDidRender}
			/>,
		);
		expect(m.createRoot).toHaveBeenCalledOnce();
		expect(wrapper().querySelectorAll(".plugin")).toHaveLength(1);
		expect(wrapper().querySelector(".plugin").textContent).toBe("two");
		expect(onComponentDidRender).toHaveBeenCalledTimes(2);
	});
});

describe("UnsafeComponent unmount", () => {
	it("unmounts the injected root with no sync-unmount warning", async () => {
		const { unmount } = render(<UnsafeComponent component={Plugin} />);
		unmount();
		await act(async () => {});
		expect(Plugin.unmounted).toBe(1);
		const warnings = consoleError.mock.calls
			.map((args) => args.map(String).join(" "))
			.filter((text) => /unmount/i.test(text));
		expect(warnings).toEqual([]);
	});

	it("unmounts cleanly when a parent removes it during its own commit", async () => {
		const Parent = ({ show }) => (
			<div>{show ? <UnsafeComponent component={Plugin} /> : null}</div>
		);
		const { rerender } = render(<Parent show />);
		rerender(<Parent show={false} />);
		await act(async () => {});
		expect(Plugin.unmounted).toBe(1);
		expect(consoleError).not.toHaveBeenCalled();
	});
});

describe("UnsafeComponent with a throwing plugin", () => {
	it("renders an empty div and reports the error in production", () => {
		render(<UnsafeComponent component={Broken} broken />);
		expect(wrapper().innerHTML).toBe("<div></div>");
		expect(NylasEnv.reportError).toHaveBeenCalledWith(
			expect.objectContaining({ message: "plugin exploded" }),
		);
	});

	it("renders the exception panel in dev mode", () => {
		NylasEnv.inDevMode.mockReturnValue(true);
		render(<UnsafeComponent component={Broken} broken />);
		const panel = wrapper().querySelector(".unsafe-component-exception");
		expect(panel.querySelector(".message").textContent).toBe(
			"Broken could not be displayed.",
		);
		expect(panel.querySelector(".trace").textContent).toContain(
			"plugin exploded",
		);
		expect(NylasEnv.reportError).toHaveBeenCalledOnce();
	});

	it("does not call onComponentDidRender for a failed render", () => {
		const onComponentDidRender = vi.fn();
		render(
			<UnsafeComponent
				component={Broken}
				broken
				onComponentDidRender={onComponentDidRender}
			/>,
		);
		expect(onComponentDidRender).not.toHaveBeenCalled();
	});

	it("reports once when a plugin that rendered starts throwing on update", () => {
		const { rerender } = render(<UnsafeComponent component={Broken} broken={false} />);
		rerender(<UnsafeComponent component={Broken} broken />);
		expect(NylasEnv.reportError).toHaveBeenCalledOnce();
		expect(wrapper().innerHTML).toBe("<div></div>");
	});

	it("shows the exception panel in dev mode when building the element fails", () => {
		NylasEnv.inDevMode.mockReturnValue(true);
		const error = new Error("bad props");
		vi.spyOn(Utils, "fastOmit").mockImplementationOnce(() => {
			throw error;
		});
		render(<UnsafeComponent component={Plugin} />);
		expect(NylasEnv.reportError).toHaveBeenCalledWith(error);
		expect(
			wrapper().querySelector(".unsafe-component-exception .message").textContent,
		).toBe("Plugin could not be displayed.");
	});

	it("renders an empty div in production when building the element fails", () => {
		vi.spyOn(Utils, "fastOmit").mockImplementationOnce(() => {
			throw new Error("bad props");
		});
		render(<UnsafeComponent component={Plugin} />);
		expect(NylasEnv.reportError).toHaveBeenCalledOnce();
		expect(wrapper().innerHTML).toBe("<div></div>");
	});

	it("tries the plugin again when its props change", () => {
		const { rerender } = render(<UnsafeComponent component={Broken} broken />);
		rerender(<UnsafeComponent component={Broken} broken={false} />);
		expect(wrapper().querySelector(".fixed").textContent).toBe("ok");
	});
});
