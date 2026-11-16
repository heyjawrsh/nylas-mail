import path from "node:path";
import {
	colourFunction,
	fontUnit,
	hasHorizontalTranslate,
	hasVariableImport,
	logicalDeclaration,
	motionCompanion,
	placeholders,
	referenceImports,
	substitute,
} from "./transforms.mjs";

export function createPlugin({
	map,
	classicSizes,
	classicDefinitions,
	appRoot,
	filename,
	input,
	report,
}) {
	return {
		install(less, manager, functions) {
			const sources = new Map();
			const definitions = placeholders(map);
			const prefixes = new Set();
			const variablesFile = path.join(
				appRoot,
				"static/variables/ui-variables.less",
			);
			const isBundle = filename === path.join(appRoot, "static/index.less");
			manager.addPreProcessor({
				process(source, { fileInfo }) {
					const file = fileInfo.filename;
					if (path.resolve(file) === variablesFile) source = definitions;
					else {
						// The bundle emits shared classes, including transitive mixin imports.
						if (!isBundle) source = referenceImports(source);
						if (file === filename && !hasVariableImport(source)) {
							// No newline: declaration line numbers remain those of the input.
							source = definitions + source;
							prefixes.add(file);
						}
					}
					source = source.replace(/\r\n?/g, "\n").replace(/^\uFEFF/, "");
					sources.set(file, source);
					return source;
				},
			});

			// Keep LESS's lazy alias semantics when a caller overrides an alias source.
			// Ordinary uses still get their own mapped role, rather than the base role.
			const dependencies = {};
			for (const [name, value] of Object.entries(classicDefinitions)) {
				const names = [];
				new less.visitors.Visitor({
					visitVariable(node) {
						names.push(node.name);
					},
				}).visit(value);
				dependencies[name] = names;
			}
			const isPlaceholder = (node) =>
				path.resolve(node.fileInfo().filename) === variablesFile ||
				(prefixes.has(node.fileInfo().filename) &&
					node.getIndex() < definitions.length);
			function hasOverride(name, context, seen = new Set()) {
				if (seen.has(name)) return false;
				seen.add(name);
				return (dependencies[name] || []).some((dependency) => {
					const declaration = context.frames
						.map((frame) => frame.variable(dependency))
						.find(Boolean);
					return (
						(declaration && !isPlaceholder(declaration)) ||
						hasOverride(dependency, context, seen)
					);
				});
			}
			manager.addVisitor({
				isPreEvalVisitor: true,
				run(root) {
					return new less.visitors.Visitor({
						visitDeclaration(node) {
							if (
								!node.variable ||
								!classicDefinitions[node.name] ||
								!isPlaceholder(node)
							)
								return;
							const evaluate = node.value.eval.bind(node.value);
							node.value.eval = (context) =>
								hasOverride(node.name, context)
									? classicDefinitions[node.name].eval(context)
									: evaluate(context);
						},
					}).visit(root);
				},
			});

			for (const name of [
				"darken",
				"lighten",
				"fade",
				"fadeout",
				"mix",
				"desaturate",
				"saturate",
			]) {
				const original = functions.get(name);
				functions.add(name, function (...args) {
					const values = args.map((arg) => arg.toCSS({}));
					return values.some((value) => value.includes("var(--L-"))
						? new less.tree.Anonymous(colourFunction(name, values))
						: original.apply(this, args);
				});
			}
			const sizes = Object.fromEntries(
				Object.entries(classicSizes).map(([name, size]) => [
					fontUnit(name),
					size,
				]),
			);
			const floor = functions.get("floor");
			functions.add("floor", function (dimension) {
				const numerator = dimension.unit?.numerator || [];
				const denominator = dimension.unit?.denominator || [];
				if (![...numerator, ...denominator].some((unit) => sizes[unit]))
					return floor.call(this, dimension);
				let value = dimension.value;
				for (const unit of numerator) value *= sizes[unit] || 1;
				for (const unit of denominator) value /= sizes[unit] || 1;
				const unit = numerator.includes("%") ? "percent" : "px";
				return new less.tree.Anonymous(
					`__port_floor_${Math.floor(value)}_${unit}__`,
				);
			});

			const motion = new WeakMap();
			let keyframes = 0;
			function location(node) {
				const file = node.fileInfo().filename;
				return {
					file:
						file === filename
							? input
							: path.isAbsolute(input)
								? file
								: path.relative(process.cwd(), file),
					line: (sources.get(file) || "").slice(0, node.getIndex()).split("\n")
						.length,
				};
			}
			const implementation = {
				run(root) {
					return new less.visitors.Visitor(this).visit(root);
				},
				visitAtRule(node) {
					if (/keyframes$/i.test(node.name)) keyframes++;
				},
				visitAtRuleOut(node) {
					if (/keyframes$/i.test(node.name)) keyframes--;
				},
				visitRuleset(node) {
					const declarations = (node.rules || []).filter(
						(rule) => rule.type === "Declaration" && !rule.variable,
					);
					const hasTranslate = declarations.some((rule) =>
						hasHorizontalTranslate(rule.value.toCSS({})),
					);
					for (const declaration of declarations) {
						const at = location(declaration);
						const mapped = substitute(declaration.value.toCSS({}), map);
						const text = `${declaration.name}: ${mapped.css}${declaration.important};`;
						for (const variable of mapped.literals)
							report.literals.push({ ...at, variable });
						if (mapped.fontSizeFloor)
							report.fontSizeFloor.push({ ...at, text });
						if (declaration.important || /!important\b/i.test(mapped.css))
							report.important.push({ ...at, text });
						const logical = logicalDeclaration(
							declaration.name,
							mapped.css,
							hasTranslate,
						);
						for (const kind of logical.unconvertible)
							report.unconvertible.push({ ...at, kind, text });
						declaration.name = logical.name;
						declaration.value = new less.tree.Anonymous(logical.value);
					}
					if (
						!keyframes &&
						node.paths?.length &&
						declarations.some((rule) =>
							/^(?:-(?:webkit|moz|ms|o)-)?(?:transition|animation)(?:-|$)/.test(
								rule.name,
							),
						)
					) {
						const selectors = node.paths.map((parts) =>
							parts
								.map((part) => part.toCSS({}))
								.join("")
								.trim(),
						);
						motion.set(node, motionCompanion(selectors));
					}
				},
				visitRulesetOut(node) {
					if (node.rules)
						node.rules = node.rules.flatMap((rule) =>
							motion.has(rule)
								? [rule, new less.tree.Anonymous(motion.get(rule))]
								: [rule],
						);
				},
			};
			manager.addVisitor(implementation);
		},
	};
}
