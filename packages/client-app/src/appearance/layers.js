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

function kernelSheet() {
	return `${layerStatement()}\n@layer kernel { [data-look] { --text-scale: 1; } }`;
}

module.exports = { LAYERS, layerStatement, kernelSheet };
