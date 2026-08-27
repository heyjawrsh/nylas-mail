// All runtime sources are now native modern JS (the 2017 babel-6/coffee JIT
// pipeline was removed during the 2026 modernization). This module stays as an
// identity "compiler" so compile-cache's extension mapping keeps working.
exports.shouldCompile = () => false;
exports.compile = (sourceCode) => sourceCode;
