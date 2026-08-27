import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

afterEach(cleanup);

import Table, { TableCell, TableRow } from "../src/components/table/table.jsx";
import TableDataSource from "../src/components/table/table-data-source.js";

const source = () => new TableDataSource({
	columns: ["Name", "Rank"],
	rows: [["Gamma", 3], ["Alpha", 1], ["Beta", 2]],
});

describe("remaining table component plumbing", () => {

	it("renders an empty numbered header cell", () => {
		const { container } = render(<Table tableDataSource={source()} displayHeader displayNumbers />);
		const numbered = container.querySelector("thead .numbered-cell");
		expect(numbered.tagName).toBe("TH");
		expect(numbered.textContent).toBe("");
	});


	it("passes data coordinates to a custom cell renderer", () => {
		const seen = [];
		function Cell({ rowIdx, colIdx, children }) {
			seen.push({ rowIdx, colIdx, children });
			return <td>{children}</td>;
		}
		render(<TableRow tableDataSource={source()} rowIdx={1} CellRenderer={Cell} />);
		expect(seen).toEqual([
			{ rowIdx: 1, colIdx: 0, children: "Alpha" },
			{ rowIdx: 1, colIdx: 1, children: 1 },
		]);
	});

	it("lets a custom header renderer observe column definitions", () => {
		function HeaderCell({ tableDataSource, colIdx, children }) {
			return <th data-column={tableDataSource.colAt(colIdx)}>{children}</th>;
		}
		render(<TableRow tableDataSource={source()} rowIdx={null} isHeader CellRenderer={HeaderCell} />);
		expect(screen.getByText("Rank").dataset.column).toBe("Rank");
	});

	it("forwards valid DOM props and filters table-only props", () => {
		render(<TableCell data-testid="cell" title="details" rowIdx={2}>Value</TableCell>);
		const cell = screen.getByTestId("cell");
		expect(cell.title).toBe("details");
		expect(cell.hasAttribute("rowIdx")).toBe(false);
	});

	it("allows a mocked data source to control rendered column order", () => {
		const mocked = {
			columns: vi.fn(() => ["Rank", "Name"]),
			cellAt: vi.fn(({ colIdx }) => [2, "Beta"][colIdx]),
		};
		render(<table><tbody><TableRow tableDataSource={mocked} rowIdx={0} /></tbody></table>);
		const cells = screen.getAllByRole("cell");
		expect(cells.map((cell) => cell.textContent)).toEqual(["2", "Beta"]);
		expect(mocked.cellAt).toHaveBeenNthCalledWith(1, { rowIdx: 0, colIdx: 0 });
	});

	it("renders rows in the exact order supplied by the data source", () => {
		// Actual behavior: Table delegates ordering to its data source; it does not
		// sort rows itself.
		const sorted = new TableDataSource({
			columns: ["Name"],
			rows: [["Alpha"], ["Beta"], ["Gamma"]],
		});
		render(<Table tableDataSource={sorted} />);
		expect(screen.getAllByRole("cell").map((cell) => cell.textContent)).toEqual([
			"Alpha", "Beta", "Gamma",
		]);
	});
});
