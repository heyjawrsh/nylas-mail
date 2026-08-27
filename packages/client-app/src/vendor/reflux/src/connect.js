var ListenerMethods = require("reflux-core/lib/ListenerMethods"),
	ListenerMixin = require("./ListenerMixin"),
	_ = require("reflux-core/lib/utils");

module.exports = (listenable, key) => {
	_.throwIf(typeof key === "undefined", "Reflux.connect() requires a key.");

	return {
		getInitialState: () => {
			if (!_.isFunction(listenable.getInitialState)) {
				return {};
			}

			return _.object([key], [listenable.getInitialState()]);
		},
		componentDidMount: function () {
			_.extend(this, ListenerMethods);

			this.listenTo(listenable, (v) => {
				this.setState(_.object([key], [v]));
			});
		},
		componentWillUnmount: ListenerMixin.componentWillUnmount,
	};
};
