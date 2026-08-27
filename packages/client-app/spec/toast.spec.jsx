import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import Toast from "../src/components/toast.jsx";

describe("Toast under React 19", () => {
	it("renders its action content", () => {
		render(
			<Toast visible className="test-toast">
				<span>sync failed</span>
			</Toast>,
		);
		expect(screen.getByText("sync failed")).toBeDefined();
	});

	it("renders nothing to the DOM when not visible", () => {
		const { container } = render(
			<Toast visible={false}>
				<span>hidden</span>
			</Toast>,
		);
		expect(container.querySelector(".nylas-toast-wrap")).toBeNull();
	});
});
