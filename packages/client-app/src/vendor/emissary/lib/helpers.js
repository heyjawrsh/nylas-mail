(() => {
	var Behavior,
		combineArray,
		combineWithFunction,
		__slice = [].slice;

	Behavior = require("./behavior");

	exports.combine = function () {
		var args;
		args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
		if (args.length === 1 && Array.isArray(args[0])) {
			return combineArray(args[0]);
		} else if (typeof args[args.length - 1] === "function") {
			return combineWithFunction(args);
		} else {
			throw new Error("Invalid object type");
		}
	};

	combineArray = (array) => {
		var behavior;
		return (behavior = new Behavior(function () {
			var element, i, outputArray, ready, _i, _len;
			outputArray = array.slice();
			ready = false;
			for (i = _i = 0, _len = array.length; _i < _len; i = ++_i) {
				element = array[i];
				if (element.constructor.name === "Behavior") {
					((element, i) =>
						this.subscribe(
							element.onValue((value, metadata) => {
								if (ready) {
									outputArray = outputArray.slice();
								}
								outputArray[i] = value;
								if (ready) {
									return this.emitValue(outputArray, metadata);
								}
							}),
						))(element, i);
				}
			}
			ready = true;
			return this.emitValue(outputArray);
		}));
	};

	combineWithFunction = (args) => {
		var fn;
		fn = args.pop();
		return combineArray(args).map((argsArray) => fn.apply(null, argsArray));
	};
}).call(this);
