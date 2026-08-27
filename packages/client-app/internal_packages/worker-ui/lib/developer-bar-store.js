/*
 * decaffeinate suggestions:
 * DS002: Fix invalid constructor
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS104: Avoid inline assignments
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
const NylasStore = require("nylas-store");
const {
	Rx,
	Actions,
	DatabaseStore,
	ProviderSyncbackRequest,
	DeltaConnectionStore,
} = require("nylas-exports");
const qs = require("node:querystring");
const _ = require("underscore");
const moment = require("moment");

class DeveloperBarCurlRequest {
	constructor({ id, request, statusCode, error }) {
		let left;
		this.id = id;
		let { url } = request;
		let urlWithAuth = url;
		if (request.auth && (request.auth.user || request.auth.pass)) {
			urlWithAuth = url.replace(
				"://",
				`://${request.auth.user != null ? request.auth.user : ""}:${request.auth.pass != null ? request.auth.pass : ""}@`,
			);
		}

		if (request.qs) {
			url += `?${qs.stringify(request.qs)}`;
			urlWithAuth += `?${qs.stringify(request.qs)}`;
		}

		let postBody = "";
		if (request.body) {
			postBody = JSON.stringify(request.body).replace(/'/g, "\\u0027");
		}

		let data = "";
		if (request.method !== "GET") {
			data = `-d '${postBody}'`;
		}

		let headers = "";
		if (request.headers) {
			for (var k in request.headers) {
				var v = request.headers[k];
				headers += `-H "${k}: ${v}" `;
			}
		}

		// When constructed during _onWillMakeAPIRequest(), `request` has not been
		// processed by node-request yet. Therefore, it will not have Content-Type
		// set in the request headers.
		if (
			request.json &&
			!request._json &&
			request.headers &&
			!Array.from(request.headers).includes("content-type") &&
			!Array.from(request.headers).includes("Content-Type")
		) {
			headers += '-H "Content-Type: application/json" ';
		}

		if (request.auth != null ? request.auth.bearer : undefined) {
			const tok = request.auth.bearer.replace("!", "\\!");
			headers += `-H "Authorization: Bearer ${tok}" `;
		}

		const baseCommand = `curl -X ${request.method} ${headers}${data}`;
		this.command = `${baseCommand} "${url}"`;
		this.commandWithAuth = `${baseCommand} "${urlWithAuth}"`;
		this.statusCode =
			(left =
				statusCode != null
					? statusCode
					: error != null
						? error.code
						: undefined) != null
				? left
				: "pending";
		this.errorMessage =
			(error != null ? error.message : undefined) != null
				? error != null
					? error.message
					: undefined
				: error;
		this.startMoment = moment(request.startTime);
		this;
	}
}

class DeveloperBarStore extends NylasStore {
	constructor() {
		super();
		this._onSyncbackRequestChange = this._onSyncbackRequestChange.bind(this);
		this._onWillMakeAPIRequest = this._onWillMakeAPIRequest.bind(this);
		this._onDidMakeAPIRequest = this._onDidMakeAPIRequest.bind(this);
		this._setStoreDefaults();
		this._registerListeners();
	}

	//########## PUBLIC #####################################################

	curlHistory() {
		return this._curlHistory;
	}

	longPollStates() {
		return this._longPollStates;
	}

	longPollHistory() {
		return this._longPollHistory;
	}

	providerSyncbackRequests() {
		return this._providerSyncbackRequests;
	}

	//########## PRIVATE ####################################################

	triggerThrottled() {
		if (this._triggerThrottled == null) {
			this._triggerThrottled = _.throttle(this.trigger, 150);
		}
		return this._triggerThrottled();
	}

	_setStoreDefaults() {
		this._curlHistoryIds = [];
		this._curlHistory = [];
		this._longPollHistory = [];
		this._longPollStates = {};
		return (this._providerSyncbackRequests = []);
	}

	_registerListeners() {
		const query = DatabaseStore.findAll(ProviderSyncbackRequest)
			.order(ProviderSyncbackRequest.attributes.id.descending())
			.limit(100);
		Rx.Observable.fromQuery(query).subscribe(this._onSyncbackRequestChange);
		this.listenTo(DeltaConnectionStore, this._onDeltaConnectionStatusChanged);
		this.listenTo(Actions.willMakeAPIRequest, this._onWillMakeAPIRequest);
		this.listenTo(Actions.didMakeAPIRequest, this._onDidMakeAPIRequest);
		this.listenTo(Actions.longPollReceivedRawDeltas, this._onLongPollDeltas);
		this.listenTo(
			Actions.longPollProcessedDeltas,
			this._onLongPollProcessedDeltas,
		);
		return this.listenTo(Actions.clearDeveloperConsole, this._onClear);
	}

	_onClear() {
		this._curlHistoryIds = [];
		this._curlHistory = [];
		this._longPollHistory = [];
		return this.trigger(this);
	}

	_onSyncbackRequestChange(reqs) {
		if (reqs == null) {
			reqs = [];
		}
		this._providerSyncbackRequests = reqs;
		return this.trigger();
	}

	_onDeltaConnectionStatusChanged() {
		this._longPollStates = {};
		_.forEach(
			DeltaConnectionStore.getDeltaConnectionStates(),
			(state, accountId) => {
				return (this._longPollStates[accountId] = state.status);
			},
		);
		return this.trigger();
	}

	_onLongPollDeltas(deltas) {
		// Add a local timestamp to deltas so we can display it
		const now = new Date();
		for (var delta of Array.from(deltas)) {
			delta.timestamp = now;
		}

		// Incoming deltas are [oldest...newest]. Append them to the beginning
		// of our internal history which is [newest...oldest]
		this._longPollHistory.unshift(
			...Array.from([].concat(deltas).reverse() || []),
		);
		if (this._longPollHistory.length > 200) {
			this._longPollHistory.length = 200;
		}
		return this.triggerThrottled(this);
	}

	_onLongPollProcessedDeltas() {
		return this.triggerThrottled(this);
	}

	_onWillMakeAPIRequest({ requestId, request }) {
		const item = new DeveloperBarCurlRequest({ id: requestId, request });

		this._curlHistory.unshift(item);
		this._curlHistoryIds.unshift(requestId);
		if (this._curlHistory.length > 200) {
			this._curlHistory.pop();
			this._curlHistoryIds.pop();
		}

		return this.triggerThrottled(this);
	}

	_onDidMakeAPIRequest({ requestId, request, statusCode, error }) {
		const idx = this._curlHistoryIds.indexOf(requestId);
		if (idx === -1) {
			return;
		} // Could be more than 200 requests ago

		const item = new DeveloperBarCurlRequest({
			id: requestId,
			request,
			statusCode,
			error,
		});
		this._curlHistory[idx] = item;
		return this.triggerThrottled(this);
	}
}

module.exports = new DeveloperBarStore();
