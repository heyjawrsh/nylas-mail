import IMAPConnectionPool from "../src/imap-connection-pool";
import IMAPConnection from "../src/imap-connection";
import {
	IMAPConnectionTimeoutError,
	IMAPSocketError,
} from "../src/imap-errors";
import { vi } from "vitest";

describe("IMAPConnectionPool", function describeBlock() {
	let account;
	let logger;

	beforeEach(() => {
		account = {
			id: "test-account",
			decryptedCredentials: () => {
				return {};
			},
			connectionSettings: {
				imap_host: "imap.foobar.com",
			},
		};
		IMAPConnectionPool._poolMap = {};
		logger = {};
		vi.spyOn(IMAPConnection.prototype, "connect").mockImplementation(
			function connectFake() {
				return this;
			},
		);
		vi.spyOn(IMAPConnection.prototype, "end").mockImplementation(() => {});
	});

	it("opens IMAP connection and properly returns to pool at end of scope", async () => {
		let invokedCallback = false;
		await IMAPConnectionPool.withConnectionsForAccount(account, {
			desiredCount: 1,
			logger,
			socketTimeout: 5 * 1000,
			onConnected: ([conn]) => {
				expect(conn instanceof IMAPConnection).toBe(true);
				invokedCallback = true;
				return false;
			},
		});
		expect(invokedCallback).toBe(true);
		expect(IMAPConnection.prototype.connect.mock.calls.length).toBe(1);
		expect(IMAPConnection.prototype.end.mock.calls.length).toBe(1);
	});

	it("opens multiple IMAP connections and properly returns to pool at end of scope", async () => {
		let invokedCallback = false;
		await IMAPConnectionPool.withConnectionsForAccount(account, {
			desiredCount: 2,
			logger,
			socketTimeout: 5 * 1000,
			onConnected: ([conn, otherConn]) => {
				expect(conn instanceof IMAPConnection).toBe(true);
				expect(otherConn instanceof IMAPConnection).toBe(true);
				invokedCallback = true;
				return false;
			},
		});
		expect(invokedCallback).toBe(true);
		expect(IMAPConnection.prototype.connect.mock.calls.length).toBe(2);
		expect(IMAPConnection.prototype.end.mock.calls.length).toBe(2);
	});

	it("opens an IMAP connection properly and only returns to pool on done", async () => {
		let invokedCallback = false;
		let doneCallback = null;
		await IMAPConnectionPool.withConnectionsForAccount(account, {
			desiredCount: 1,
			logger,
			socketTimeout: 5 * 1000,
			onConnected: ([conn], done) => {
				expect(conn instanceof IMAPConnection).toBe(true);
				invokedCallback = true;
				doneCallback = done;
				return true;
			},
		});
		expect(invokedCallback).toBe(true);
		expect(IMAPConnection.prototype.connect.mock.calls.length).toBe(1);
		expect(IMAPConnection.prototype.end.mock.calls.length).toBe(0);
		expect(IMAPConnectionPool._poolMap[account.id]._availableConns.length).toBe(
			2,
		);
		doneCallback();
		expect(IMAPConnectionPool._poolMap[account.id]._availableConns.length).toBe(
			3,
		);
	});

	it("waits for an available IMAP connection", async () => {
		let invokedCallback = false;
		let doneCallback = null;
		await IMAPConnectionPool.withConnectionsForAccount(account, {
			desiredCount: 3,
			logger,
			socketTimeout: 5 * 1000,
			onConnected: ([conn], done) => {
				expect(conn instanceof IMAPConnection).toBe(true);
				invokedCallback = true;
				doneCallback = done;
				return true;
			},
		});
		expect(invokedCallback).toBe(true);
		expect(IMAPConnection.prototype.connect.mock.calls.length).toBe(3);
		expect(IMAPConnection.prototype.end.mock.calls.length).toBe(0);

		invokedCallback = false;
		const promise = IMAPConnectionPool.withConnectionsForAccount(account, {
			desiredCount: 1,
			logger,
			socketTimeout: 5 * 1000,
			onConnected: ([conn]) => {
				expect(conn instanceof IMAPConnection).toBe(true);
				invokedCallback = true;
				return false;
			},
		});

		expect(IMAPConnectionPool._poolMap[account.id]._queue.length).toBe(1);
		doneCallback();
		await promise;

		expect(invokedCallback).toBe(true);
		expect(IMAPConnection.prototype.connect.mock.calls.length).toBe(4);
		expect(IMAPConnection.prototype.end.mock.calls.length).toBe(4);
	});

	it("does not retry on IMAP connection timeout", async () => {
		let invokeCount = 0;
		try {
			await IMAPConnectionPool.withConnectionsForAccount(account, {
				desiredCount: 1,
				logger,
				socketTimeout: 5 * 1000,
				onConnected: ([conn]) => {
					expect(conn instanceof IMAPConnection).toBe(true);
					if (invokeCount === 0) {
						invokeCount += 1;
						throw new IMAPConnectionTimeoutError();
					}
					invokeCount += 1;
					return false;
				},
			});
		} catch (err) {
			expect(err instanceof IMAPConnectionTimeoutError).toBe(true);
		}

		expect(invokeCount).toBe(1);
		expect(IMAPConnection.prototype.connect.mock.calls.length).toBe(1);
		expect(IMAPConnection.prototype.end.mock.calls.length).toBe(1);
	});

	it("does not retry on other IMAP error", async () => {
		let invokeCount = 0;
		let errorCount = 0;
		try {
			await IMAPConnectionPool.withConnectionsForAccount(account, {
				desiredCount: 1,
				logger,
				socketTimeout: 5 * 1000,
				onConnected: ([conn]) => {
					expect(conn instanceof IMAPConnection).toBe(true);
					if (invokeCount === 0) {
						invokeCount += 1;
						throw new IMAPSocketError();
					}
					invokeCount += 1;
					return false;
				},
			});
		} catch (_err) {
			errorCount += 1;
		}

		expect(invokeCount).toBe(1);
		expect(errorCount).toBe(1);
		expect(IMAPConnection.prototype.connect.mock.calls.length).toBe(1);
		expect(IMAPConnection.prototype.end.mock.calls.length).toBe(1);
	});
});
