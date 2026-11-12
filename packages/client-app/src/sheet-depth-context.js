import React from "react";

// The depth of the sheet (or sheet toolbar) a component renders in, as
// `{ sheetDepth }`. Replaces the legacy `sheetDepth` child context, which
// React 19 removed.
const SheetDepthContext = React.createContext({});
SheetDepthContext.displayName = "SheetDepthContext";

export default SheetDepthContext;
