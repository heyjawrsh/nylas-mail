import { afterEach, describe, expect, it, vi } from "vitest";
import { deepClone, copyModelValues, isValidId } from "../src/model-utils.js";
import TrackingUtils from "../src/tracking-utils.js";
import { isClientEnv, isCloudEnv, inDevMode } from "../src/env-helpers.js";
import { SECURE_TLS_OPTIONS, INSECURE_TLS_OPTIONS } from "../src/tls-utils.js";
import MetricsReporter from "../src/metrics-reporter.js";
import migration from "../src/migrations/20160617002207-create-user.js";

afterEach(() => {
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
});

describe("model utilities", () => {
	it("deep clones prototypes, dates, hidden properties and circular references", () => {
		class Thing {
			method() {
				return "ok";
			}
		}
		const source = new Thing();
		source.date = new Date("2020-01-01Z");
		source.array = [{ value: 1 }];
		source.fn = () => 1;
		source.self = source;
		Object.defineProperty(source, "hidden", { value: "secret" });
		const cloned = deepClone(source, (key, value) =>
			key === "value" ? 2 : value,
		);
		expect(cloned).not.toBe(source);
		expect(cloned).toBeInstanceOf(Thing);
		expect(cloned.method()).toBe("ok");
		expect(cloned.date).toEqual(source.date);
		expect(cloned.date).not.toBe(source.date);
		expect(cloned.array).toEqual([{ value: 2 }]);
		expect(cloned.fn).toBe(source.fn);
		expect(cloned.self).toBe(cloned);
		expect(cloned.hidden).toBe("secret");
	});

	it("copies getter values with updates and validates base-36 ids", () => {
		const model = {
			dataValues: { raw: "ignored", count: 1 },
			get raw() {
				return { parsed: true };
			},
			count: 1,
		};
		expect(copyModelValues(model, { count: 2 })).toEqual({
			raw: { parsed: true },
			count: 2,
		});
		expect(isValidId("abc123")).toBe(true);
		expect(isValidId(0)).toBe(true);
		expect(isValidId(null)).toBe(false);
		expect(isValidId("!")).toBe(false);
	});
});

describe("tracking utilities", () => {
	it("prepares placeholders and activates the open pixel", () => {
		const body =
			'<a href="https://api/link/MESSAGE_ID">x</a><img data-open-tracking-src="https://api/open/MESSAGE_ID">';
		expect(TrackingUtils.prepareTrackingLinks("m123", body)).toBe(
			'<a href="https://api/link/m123">x</a><img src="https://api/open/m123">',
		);
	});

	it("adds an encoded recipient to open and link tracking URLs", () => {
		const body = TrackingUtils.addRecipientToTrackingLinks({
			baseMessage: {
				body: '<img class="n1-open" src="https://n1.nylas.com/open/id"><a href="https://n1.nylas.com/link/id?redirect=https%3A%2F%2Fexample.com">go</a><a href="mailto:a@b.com">mail</a>',
			},
			recipient: { email: "a+b@example.com" },
			usesOpenTracking: true,
			usesLinkTracking: true,
		});
		expect(body).toContain("recipient=a%2Bb%40example.com");
		expect(body).toContain('width="0"');
		expect(body).toContain("mailto:a@b.com");
	});

	it("strips its pixel and restores only Nylas redirect links", () => {
		const tracked =
			'<img class="n1-open" src="https://n1.nylas.com/open/id"><a href="https://n1.nylas.com/link/id?redirect=https%3A%2F%2Fexample.com%2Fa">go</a><a href="https://other.test/?redirect=https%3A%2F%2Fsafe.test">other</a>';
		const result = TrackingUtils.stripTrackingLinksFromBody(tracked);
		expect(result).not.toContain("n1-open");
		expect(result).toContain('href="https://example.com/a"');
		expect(result).toContain('href="https://other.test/');
	});
});

describe("environment, TLS, metrics and migration helpers", () => {
	it("detects server and browser modes", () => {
		expect(isClientEnv()).toBe(false);
		expect(isCloudEnv()).toBe(true);
		vi.stubEnv("NODE_ENV", "production");
		expect(inDevMode()).toBe(false);
		vi.stubGlobal("window", { NylasEnv: { inDevMode: vi.fn(() => true) } });
		expect(isClientEnv()).toBe(true);
		expect(isCloudEnv()).toBe(false);
		expect(inDevMode()).toBe(true);
	});

	it("exports explicit secure and insecure TLS 1.2 policies", () => {
		expect(SECURE_TLS_OPTIONS).toEqual({
			minVersion: "TLSv1.2",
			rejectUnauthorized: true,
		});
		expect(INSECURE_TLS_OPTIONS).toEqual({
			minVersion: "TLSv1.2",
			rejectUnauthorized: false,
		});
	});

	it("keeps the disabled metrics reporter awaitable", async () => {
		await expect(MetricsReporter.collectCPUUsage()).resolves.toBeUndefined();
		await expect(
			MetricsReporter.reportEvent({ name: "sync" }),
		).resolves.toBeUndefined();
	});

	it("creates and drops the Users migration table", async () => {
		const queryInterface = {
			createTable: vi.fn(async () => "created"),
			dropTable: vi.fn(async () => "dropped"),
		};
		const Sequelize = {
			INTEGER: "INTEGER",
			STRING: "STRING",
			TEXT: "TEXT",
			DATE: "DATE",
		};
		await expect(migration.up(queryInterface, Sequelize)).resolves.toBe(
			"created",
		);
		expect(queryInterface.createTable).toHaveBeenCalledWith(
			"Users",
			expect.objectContaining({
				id: {
					allowNull: false,
					autoIncrement: true,
					primaryKey: true,
					type: "INTEGER",
				},
				bio: { type: "TEXT" },
			}),
		);
		await expect(migration.down(queryInterface, Sequelize)).resolves.toBe(
			"dropped",
		);
		expect(queryInterface.dropTable).toHaveBeenCalledWith("Users");
	});
});
