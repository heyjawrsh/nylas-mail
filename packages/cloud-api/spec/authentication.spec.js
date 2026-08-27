import { beforeEach, describe, expect, it, vi } from "vitest";
const forShared = vi.hoisted(() => vi.fn());
vi.mock("cloud-core", () => ({ DatabaseConnector: { forShared } }));
import {
	apiAuthenticate,
	resetAuthenticationCache,
} from "../src/authentication";

describe("basic authentication", () => {
	beforeEach(() => {
		forShared.mockReset();
		resetAuthenticationCache();
	});
	it("rejects an unknown account token", async () => {
		forShared.mockResolvedValue({
			AccountToken: { find: vi.fn().mockResolvedValue(null) },
		});
		expect(await apiAuthenticate({}, "missing")).toEqual({
			isValid: false,
			credentials: {},
		});
	});
	it("attaches the account to valid credentials", async () => {
		const account = { id: "a" };
		forShared.mockResolvedValue({
			AccountToken: {
				find: vi.fn().mockResolvedValue({ getAccount: async () => account }),
			},
		});
		const request = {
			logger: { forAccount: vi.fn().mockReturnValue("account logger") },
		};
		expect(await apiAuthenticate(request, "valid")).toEqual({
			isValid: true,
			credentials: { account },
		});
		expect(request.logger).toBe("account logger");
	});
});
