const { Observable } = require("rxjs");
const { createClient } = require("redis");

class PubsubConnector {
	constructor() {
		this._broadcastClient = null;
		this._listenClientSubs = {};
	}

	async buildClient(accountId, { onClose } = {}) {
		const client = createClient(
			process.env.REDIS_URL ? { url: process.env.REDIS_URL } : undefined,
		);
		global.Logger.info({ account_id: accountId }, "Connecting to Redis");
		client.on("error", (err) => {
			global.Logger.error({ err, account_id: accountId }, "Redis error");
			if (onClose) onClose();
		});
		client.on("end", () => {
			global.Logger.info({ account_id: accountId }, "Redis disconnected");
			if (onClose) onClose();
		});
		await client.connect();
		return client;
	}

	async broadcastClient() {
		if (!this._broadcastClient) {
			// We null out the memoized broadcast client. In case it closes
			// for any reason, we want to make sure the next time it's
			// requested, we'll create a new one.
			this._broadcastClient = this.buildClient("broadcast", {
				onClose: () => {
					this._broadcastClient = null;
				},
			});
		}
		return this._broadcastClient;
	}

	async notifyDelta(accountId, transactionJSON) {
		const client = await this.broadcastClient();
		return client.publish(
			`deltas-${accountId}`,
			JSON.stringify(transactionJSON),
		);
	}

	observeDeltas(accountId) {
		return new Observable((observer) => {
			let sub = null;
			let closed = false;
			this.buildClient(accountId)
				.then((client) => {
					if (closed) {
						client.quit();
						return;
					}
					sub = client;
					client.on("message", (_channel, transactionJSONString) => {
						observer.next(JSON.parse(transactionJSONString));
					});
					client.subscribe(`deltas-${accountId}`);
				})
				.catch((err) => observer.error(err));
			return () => {
				closed = true;
				global.Logger.info({ account_id: accountId }, "Closing Redis");
				if (sub) {
					sub.unsubscribe();
					sub.quit();
				}
			};
		});
	}
}

module.exports = new PubsubConnector();
