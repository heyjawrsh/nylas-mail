/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
let Color;
const _ = require("underscore");
let ParsedColor = null;

// Essential: A simple color class returned from {Config::get} when the value
// at the key path is of type 'color'.
module.exports = Color = class Color {
	// Essential: Parse a {String} or {Object} into a {Color}.
	//
	// * `value` A {String} such as `'white'`, `#ff00ff`, or
	//   `'rgba(255, 15, 60, .75)'` or an {Object} with `red`, `green`, `blue`,
	//   and `alpha` properties.
	//
	// Returns a {Color} or `null` if it cannot be parsed.
	static parse(value) {
		let parsedColor;
		if (_.isArray(value) || _.isFunction(value)) {
			return null;
		}
		if (!_.isObject(value) && !_.isString(value)) {
			return null;
		}

		if (ParsedColor == null) {
			ParsedColor = require("color");
		}

		try {
			parsedColor = new ParsedColor(value);
		} catch (error) {
			return null;
		}

		return new Color(
			parsedColor.red(),
			parsedColor.green(),
			parsedColor.blue(),
			parsedColor.alpha(),
		);
	}

	constructor(red, green, blue, alpha) {
		Object.defineProperties(this, {
			red: {
				set(newRed) {
					return (red = parseColor(newRed));
				},
				get() {
					return red;
				},
				enumerable: true,
				configurable: false,
			},
			green: {
				set(newGreen) {
					return (green = parseColor(newGreen));
				},
				get() {
					return green;
				},
				enumerable: true,
				configurable: false,
			},
			blue: {
				set(newBlue) {
					return (blue = parseColor(newBlue));
				},
				get() {
					return blue;
				},
				enumerable: true,
				configurable: false,
			},
			alpha: {
				set(newAlpha) {
					return (alpha = parseAlpha(newAlpha));
				},
				get() {
					return alpha;
				},
				enumerable: true,
				configurable: false,
			},
		});

		this.red = red;
		this.green = green;
		this.blue = blue;
		this.alpha = alpha;
	}

	// Essential: Returns a {String} in the form `'#abcdef'`.
	toHexString() {
		return `#${numberToHexString(this.red)}${numberToHexString(this.green)}${numberToHexString(this.blue)}`;
	}

	// Essential: Returns a {String} in the form `'rgba(25, 50, 75, .9)'`.
	toRGBAString() {
		return `rgba(${this.red}, ${this.green}, ${this.blue}, ${this.alpha})`;
	}

	isEqual(color) {
		if (this === color) {
			return true;
		}
		if (!(color instanceof Color)) {
			color = Color.parse(color);
		}
		if (color == null) {
			return false;
		}
		return (
			color.red === this.red &&
			color.blue === this.blue &&
			color.green === this.green &&
			color.alpha === this.alpha
		);
	}

	clone() {
		return new Color(this.red, this.green, this.blue, this.alpha);
	}
};

var parseColor = (color) => {
	color = parseInt(color);
	if (isNaN(color)) {
		color = 0;
	}
	color = Math.max(color, 0);
	color = Math.min(color, 255);
	return color;
};

var parseAlpha = (alpha) => {
	alpha = parseFloat(alpha);
	if (isNaN(alpha)) {
		alpha = 1;
	}
	alpha = Math.max(alpha, 0);
	alpha = Math.min(alpha, 1);
	return alpha;
};

var numberToHexString = (number) => {
	let hex = number.toString(16);
	if (number < 10) {
		hex = `0${hex}`;
	}
	return hex;
};
