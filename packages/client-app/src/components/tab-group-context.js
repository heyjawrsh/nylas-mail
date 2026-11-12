import React from "react";

// Gives fields inside a {TabGroupRegion} a handle on it as `parentTabGroup`,
// so they can move focus through the group (`parentTabGroup.shiftFocus(1)`).
// Outside any region the value is `{}`, so `parentTabGroup` is undefined.
const TabGroupContext = React.createContext({});
TabGroupContext.displayName = "TabGroupContext";

export default TabGroupContext;
