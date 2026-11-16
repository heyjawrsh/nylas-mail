const LAYERS = [
	"reset",
	"kernel",
	"theme",
	"font",
	"baseline",
	"style",
	"plugin",
];

function layerStatement() {
	return `@layer ${LAYERS.join(", ")};`;
}

module.exports = { LAYERS, layerStatement };
