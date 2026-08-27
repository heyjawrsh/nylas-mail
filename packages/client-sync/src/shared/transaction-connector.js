import { Observable } from "rxjs";
import EventEmitter from "events";

class TransactionConnector extends EventEmitter {
	notifyDelta(accountId, transaction) {
		this.emit(accountId, transaction);
	}

	getObservableForAccountId(accountId) {
		return new Observable((observer) => {
			const listener = (value) => observer.next(value);
			this.on(accountId, listener);
			return () => this.removeListener(accountId, listener);
		});
	}
}

export default new TransactionConnector();
