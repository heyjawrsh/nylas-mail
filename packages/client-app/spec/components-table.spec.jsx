import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import Table, { TableCell, TableRow } from "../src/components/table/table.jsx";
import TableDataSource from "../src/components/table/table-data-source.js";

const makeSource = () =>
	new TableDataSource({
		columns: ["Name", "Count"],
		rows: [
			["Alpha", 2],
			["Beta", null],
			["", 0],
		],
	});

describe("TableDataSource", () => {
	it("starts with empty columns and one empty row", () => {
		const source = new TableDataSource();
		expect(source.columns()).toEqual([]);
		expect(source.rows()).toEqual([[]]);
	});

	it("returns columns and rows by index", () => {
		const source = makeSource();
		expect(source.colAt(1)).toBe("Count");
		expect(source.rowAt(0)).toEqual(["Alpha", 2]);
	});

	it("returns null for missing columns and rows", () => {
		const source = makeSource();
		expect(source.colAt(10)).toBeNull();
		expect(source.rowAt(10)).toBeNull();
	});

	it("treats a null row index as the header row", () => {
		expect(makeSource().rowAt(null)).toEqual(["Name", "Count"]);
	});

	it("reads header and body cells", () => {
		const source = makeSource();
		expect(source.cellAt({ colIdx: 0 })).toBe("Name");
		expect(source.cellAt({ rowIdx: 0, colIdx: 1 })).toBe(2);
		expect(source.cellAt({ rowIdx: 1, colIdx: 1 })).toBeNull();
	});

	it("identifies empty cells and rows", () => {
		const source = makeSource();
		expect(source.isEmpty({ rowIdx: 1, colIdx: 1 })).toBe(true);
		expect(source.isEmpty({ rowIdx: 2 })).toBe(true);
		expect(source.isEmpty({ rowIdx: 0 })).toBe(false);
	});

	it("rejects invalid emptiness queries", () => {
		const source = makeSource();
		expect(() => source.isEmpty()).toThrow("Must provide rowIdx");
		expect(() => source.isEmpty({ rowIdx: 99 })).toThrow("valid rowIdx");
	});

	it("adds a column without changing the original", () => {
		const source = makeSource();
		const updated = source.addColumn("Total");
		expect(updated.columns()).toEqual(["Name", "Count", "Total"]);
		expect(updated.rows()[0]).toEqual(["Alpha", 2, null]);
		expect(source.columns()).toEqual(["Name", "Count"]);
	});

	it("removes the last column and its cells", () => {
		const updated = makeSource().removeLastColumn();
		expect(updated.columns()).toEqual(["Name"]);
		expect(updated.rows()).toEqual([["Alpha"], ["Beta"], [""]]);
	});

	it("adds a blank row matching the first row width", () => {
		const updated = makeSource().addRow();
		expect(updated.rows().at(-1)).toEqual([null, null]);
		expect(updated.rows()).toHaveLength(4);
	});

	it("removes the last row immutably", () => {
		const source = makeSource();
		const updated = source.removeRow();
		expect(updated.rows()).toHaveLength(2);
		expect(source.rows()).toHaveLength(3);
	});

	it("updates a body cell without mutating its source row", () => {
		const source = makeSource();
		const originalRow = source.rowAt(1);
		const updated = source.updateCell({ rowIdx: 1, colIdx: 1, value: 7 });
		expect(updated.rowAt(1)).toEqual(["Beta", 7]);
		expect(source.rowAt(1)).toBe(originalRow);
		expect(source.cellAt({ rowIdx: 1, colIdx: 1 })).toBeNull();
	});

	it("updates a header cell", () => {
		const updated = makeSource().updateCell({
			colIdx: 1,
			isHeader: true,
			value: "Quantity",
		});
		expect(updated.columns()).toEqual(["Name", "Quantity"]);
	});

	it("filters rows into a new source", () => {
		const updated = makeSource().filterRows((row) => row[1] > 0);
		expect(updated.rows()).toEqual([["Alpha", 2]]);
		expect(updated.columns()).toEqual(["Name", "Count"]);
	});

	it("clears data and exposes a shallow JSON copy", () => {
		const source = makeSource();
		expect(source.clear().toJSON()).toEqual({ columns: [], rows: [[]] });
		expect(source.toJSON()).not.toBe(source._tableData);
	});
});

describe("table presentation", () => {
	it("renders body and header cells with the correct tags", () => {
		render(
			<table>
				<tbody>
					<tr>
						<TableCell>value</TableCell>
						<TableCell isHeader>heading</TableCell>
					</tr>
				</tbody>
			</table>,
		);
		expect(screen.getByText("value").tagName).toBe("TD");
		expect(screen.getByText("heading").tagName).toBe("TH");
	});

	it("renders a numbered table row", () => {
		render(
			<table>
				<tbody>
					<TableRow tableDataSource={makeSource()} rowIdx={0} displayNumbers />
				</tbody>
			</table>,
		);
		expect(screen.getByText("1")).toBeDefined();
		expect(screen.getByText("Alpha")).toBeDefined();
		expect(screen.getByText("2")).toBeDefined();
	});

	it("exposes its data source class", () => {
		expect(Table.TableDataSource).toBe(TableDataSource);
	});
});
