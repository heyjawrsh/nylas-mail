import React, { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

const m = vi.hoisted(() => ({
	replacer: vi.fn((_key, value) => value),
	reviver: vi.fn((_key, value) => value),
}));

vi.mock("react", async (importOriginal) => {
	const actual = await importOriginal();
	return { default: actual.default, ...actual };
});
vi.mock("prop-types", () => {
	const checker = Object.assign(() => null, { isRequired: () => null });
	const types = new Proxy({ arrayOf: () => checker, oneOfType: () => checker }, {
		get: (target, key) => target[key] || checker,
	});
	return { default: types, ...types };
});
vi.mock("react-dom", async (importOriginal) => {
	const actual = await importOriginal();
	const findDOMNode = (value) => value instanceof Element ? value : value?.inputRef?.current || value;
	return { default: { ...actual.default, findDOMNode }, ...actual, findDOMNode };
});
vi.mock("classnames", () => {
	const classNames = (...values) => values.flatMap((value) => {
		if (typeof value === "string") return [value];
		if (value && typeof value === "object") return Object.keys(value).filter((key) => value[key]);
		return [];
	}).join(" ");
	return { default: classNames, classNames };
});
vi.mock("underscore", () => {
	const underscore = {
		extend: (target, ...sources) => Object.assign(target, ...sources),
		isArray: Array.isArray,
		last: (items) => items?.[items.length - 1],
	};
	return { default: underscore, ...underscore };
});
vi.mock("@electron/remote", () => {
	class Menu { append() {} popup() {} }
	class MenuItem { constructor(options) { Object.assign(this, options); } }
	const remote = { Menu, MenuItem, getCurrentWindow: vi.fn() };
	return { default: remote, ...remote, remote };
});
vi.mock("nylas-exports", () => {
	const exports = {
		Utils: { registeredObjectReplacer: m.replacer, registeredObjectReviver: m.reviver },
		RegExpUtils: { emailRegex: () => /[\w.+-]+@[\w.-]+\.[A-Za-z]+/ },
	};
	return { default: exports, ...exports };
});
vi.mock("nylas-component-kit", () => {
	class Menu extends React.Component {
		constructor(props) { super(props); this.state = { selected: 0 }; }
		getSelectedItem() { return this.props.items[this.state.selected] || null; }
		onKeyDown = (event) => {
			if (!this.props.items.length) return;
			if (event.key === "ArrowDown") {
				this.setState(({ selected }) => ({ selected: (selected + 1) % this.props.items.length }));
			}
			if (event.key === "ArrowUp") {
				this.setState(({ selected }) => ({ selected: (selected - 1 + this.props.items.length) % this.props.items.length }));
			}
		};
		render() {
			return <div className={this.props.className} onKeyDown={this.onKeyDown}>
				{this.props.headerComponents}
				{this.props.items.map((item, index) => <button
					type="button"
					aria-selected={index === this.state.selected}
					data-testid={`choice-${item.id}`}
					key={item.id}
					onMouseDown={() => this.props.onSelect(item)}
				>{this.props.itemContent(item)}</button>)}
			</div>;
		}
	}
	return { default: { Menu }, Menu };
});
vi.mock("../src/components/retina-img.jsx", () => {
	const RetinaImg = Object.assign(() => <span />, { Mode: { ContentIsMask: "mask" } });
	return { default: RetinaImg, RetinaImg };
});
vi.mock("../src/components/key-commands-region.jsx", () => {
	class KeyCommandsRegion extends React.Component {
		render() {
			const { localHandlers: _localHandlers, ...props } = this.props;
			return <div {...props} />;
		}
	}
	return { default: KeyCommandsRegion, KeyCommandsRegion };
});

import TokenizingTextField from "../src/components/tokenizing-text-field.jsx";

const token = (id, label = id) => ({ id, label, toString: () => label });
const alice = token("alice", "Alice");
const bob = token("bob", "Bob");
const cara = token("cara", "Cara");
const drew = token("drew", "Drew");

function fixture(overrides = {}) {
	const ref = createRef();
	const props = {
		tokens: [alice, bob],
		tokenKey: (item) => item.id,
		tokenRenderer: ({ token: item }) => <span>{item.label}</span>,
		onRequestCompletions: vi.fn(() => []),
		completionNode: (item) => <span>{item.label}</span>,
		onAdd: vi.fn(),
		onRemove: vi.fn(),
		...overrides,
	};
	const view = render(<TokenizingTextField ref={ref} {...props} />);
	return {
		...view,
		ref,
		props,
		input: () => view.container.querySelector(".tokenizing-field-input > span input"),
		wrap: () => view.container.querySelector(".tokenizing-field-wrap"),
	};
}

afterEach(cleanup);

beforeEach(() => {
	vi.clearAllMocks();
});



describe("max-token input clamping", () => {
	it("marks the field when its token count equals the maximum", () => {
		const f = fixture({ maxTokens: 2 });
		expect(f.container.querySelector(".tokenizing-field-input").classList.contains("at-max-tokens")).toBe(true);
	});

	it("marks the field when its token count exceeds the maximum", () => {
		const f = fixture({ maxTokens: 1 });
		expect(f.container.querySelector(".tokenizing-field-input").classList.contains("at-max-tokens")).toBe(true);
	});

	it("renders the clamped input with the noop class", () => {
		const f = fixture({ maxTokens: 2 });
		expect(f.input().className).toBe("noop-input");
	});


	it("does not request suggestions when the clamped input receives focus", () => {
		const f = fixture({ maxTokens: 2 });
		fireEvent.focus(f.input());
		expect(f.props.onRequestCompletions).not.toHaveBeenCalled();
	});

	it("ignores input changes while clamped", () => {
		const f = fixture({ maxTokens: 2 });
		fireEvent.change(f.input(), { target: { value: "Cara" } });
		expect(f.ref.current.state.inputValue).toBe("");
		expect(f.props.onRequestCompletions).not.toHaveBeenCalled();
	});

	it("ignores paste while clamped", () => {
		const f = fixture({ maxTokens: 2 });
		fireEvent.paste(f.input(), { clipboardData: { getData: () => "cara@example.com" } });
		expect(f.props.onAdd).not.toHaveBeenCalled();
	});

});

describe("drop-target acceptance", () => {
	it("rejects a drop without the Nylas token MIME type", () => {
		const f = fixture();
		fireEvent.drop(f.wrap(), { dataTransfer: { types: ["text/plain"], getData: vi.fn() } });
		expect(f.props.onAdd).not.toHaveBeenCalled();
	});

	it("does not read data from a rejected drop", () => {
		const f = fixture();
		const getData = vi.fn();
		fireEvent.drop(f.wrap(), { dataTransfer: { types: ["Files"], getData } });
		expect(getData).not.toHaveBeenCalled();
	});

	it("accepts the token MIME type among additional transfer types", () => {
		const f = fixture();
		fireEvent.drop(f.wrap(), {
			dataTransfer: { types: ["text/plain", "nylas-token-items"], getData: () => JSON.stringify([cara]) },
		});
		expect(f.props.onAdd).toHaveBeenCalledWith([expect.objectContaining({ id: "cara" })]);
	});

	it("adds every token in an accepted multi-item drop", () => {
		const f = fixture();
		fireEvent.drop(f.wrap(), {
			dataTransfer: { types: ["nylas-token-items"], getData: () => JSON.stringify([cara, drew]) },
		});
		expect(f.props.onAdd).toHaveBeenCalledWith([
			expect.objectContaining({ id: "cara" }), expect.objectContaining({ id: "drew" }),
		]);
	});

	it("parses accepted drops with the registered object reviver", () => {
		const f = fixture();
		fireEvent.drop(f.wrap(), {
			dataTransfer: { types: ["nylas-token-items"], getData: () => JSON.stringify([cara]) },
		});
		expect(m.reviver).toHaveBeenCalled();
	});

	it("reports malformed accepted JSON without adding tokens", () => {
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		const f = fixture();
		fireEvent.drop(f.wrap(), {
			dataTransfer: { types: ["nylas-token-items"], getData: () => "{" },
		});
		expect(error).toHaveBeenCalledOnce();
		expect(f.props.onAdd).not.toHaveBeenCalled();
		error.mockRestore();
	});

	it("ignores a serialized null payload", () => {
		const f = fixture();
		fireEvent.drop(f.wrap(), {
			dataTransfer: { types: ["nylas-token-items"], getData: () => "null" },
		});
		expect(f.props.onAdd).not.toHaveBeenCalled();
	});

	it("accepts serialized drops even while the text input is max-clamped", () => {
		const f = fixture({ maxTokens: 2 });
		fireEvent.drop(f.wrap(), {
			dataTransfer: { types: ["nylas-token-items"], getData: () => JSON.stringify([cara]) },
		});
		expect(f.props.onAdd).toHaveBeenCalledWith([expect.objectContaining({ id: "cara" })]);
	});
});
