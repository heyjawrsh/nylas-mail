# CoffeeScript migration blockers

The supplied converter is `decaffeinate v8.1.4`, which does not accept the required
`--use-strict` or `--prefer-const` options. Its help indicates that strict output and
`const` are defaults in this version, so the five plain `.coffee` files were converted
with the equivalent command, parse-checked with the supplied esbuild, and removed only
after successful parsing.

The remaining 22 `.cjsx` files cannot be converted by the supplied binary. It targets
`.js` rather than the required `.jsx` and parses the embedded JSX as CoffeeScript,
failing with errors such as `missing / (unclosed regex)` and `unexpected <`. The
offline decaffeinate tool bundle and repository dependencies do not contain
`coffee-react-transform`, `cjsx-transform`, or another CJSX preprocessor.

Questions:

1. Can a CJSX-capable converter/preprocessor be provided at an absolute local path?
2. Alternatively, should the remaining CJSX files be converted manually despite the
   required method specifying decaffeinate for every file?

No failed CJSX source was removed, and the converter did not produce broken output
files for those failures.
