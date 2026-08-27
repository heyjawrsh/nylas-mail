import { Observable } from "rxjs";
import Sequelize from "sequelize";

// Shared model extension: chunked findAll as an Observable stream.
// Loaded for its side effect by both cloud-core's and client-sync's
// database connectors before any models are used.
Sequelize.Model.prototype.streamAll = function streamAll(options = {}) {
	return new Observable((observer) => {
		const chunkSize = options.chunkSize || 1000;
		options.offset = 0;
		options.limit = chunkSize;

		const findFn = (opts) => {
			this.findAll(opts).then((models = []) => {
				observer.next(models);
				if (models.length === chunkSize) {
					opts.offset = chunkSize;
					findFn(opts);
				} else {
					observer.complete();
				}
			});
		};

		findFn(options);
	});
};
