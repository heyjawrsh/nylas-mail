/*
 * decaffeinate suggestions:
 * DS002: Fix invalid constructor
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__, or convert again using --optional-chaining
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
const React = require('react');
const ReactDOM = require('react-dom');
const Sheet = require('./sheet');
const Flexbox = require('./components/flexbox').default;
const RetinaImg = require('./components/retina-img').default;
const Utils = require('./flux/models/utils');
const {remote} = require('electron');
const _str = require('underscore.string');
const _ = require('underscore');

const {Actions,
 ComponentRegistry,
 WorkspaceStore} = require("nylas-exports");

class ToolbarSpacer extends React.Component {
  constructor(...args) {
    this.render = this.render.bind(this);
    super(...args);
  }

  static initClass() {
    this.displayName = 'ToolbarSpacer';
    this.propTypes =
      {order: PropTypes.number};
  }

  render() {
    return React.createElement("div", {"className": "item-spacer", "style": ({flex: 1, order:this.props.order != null ? this.props.order : 0})});
  }
}
ToolbarSpacer.initClass();

class WindowTitle extends React.Component {
  static initClass() {
    this.displayName = "WindowTitle";
  }

  constructor(props) {
    this.props = props;
    this.state = NylasEnv.getLoadSettings();
  }

  componentDidMount() {
    return this.unlisten = NylasEnv.onWindowPropsReceived(windowProps => {
      return this.setState(NylasEnv.getLoadSettings());
    });
  }

  componentWillUnmount() {
    return (typeof this.unlisten === 'function' ? this.unlisten() : undefined);
  }

  render() {
    return React.createElement("div", {"className": "window-title"}, (this.state.title));
  }
}
WindowTitle.initClass();

let Category = null;
let FocusedPerspectiveStore = null;
class ToolbarBack extends React.Component {
  static initClass() {
    this.displayName = 'ToolbarBack';
  }

  // These stores are only required when this Toolbar is actually needed.
  // This is because loading these stores has database side effects.
  constructor(props) {
    this.componentDidMount = this.componentDidMount.bind(this);
    this.componentWillUnmount = this.componentWillUnmount.bind(this);
    this.render = this.render.bind(this);
    this._onClick = this._onClick.bind(this);
    this.props = props;
    if (Category == null) { Category = require('./flux/models/category').default; }
    if (FocusedPerspectiveStore == null) { FocusedPerspectiveStore = require('./flux/stores/focused-perspective-store').default; }
    this.state =
      {categoryName: FocusedPerspectiveStore.current().name};
  }

  componentDidMount() {
    return this._unsubscriber = FocusedPerspectiveStore.listen(() => {
      return this.setState({categoryName: FocusedPerspectiveStore.current().name});
    });
  }

  componentWillUnmount() {
    if (this._unsubscriber) { return this._unsubscriber(); }
  }

  render() {
    let title;
    if (this.state.categoryName === Category.AllMailName) {
      title = 'All Mail';
    } else if (this.state.categoryName) {
      title = _str.titleize(this.state.categoryName);
    } else {
      title = "Back";
    }

    return React.createElement("div", {"className": "item-back", "onClick": (this._onClick), "title": `Return to ${title}`},
      React.createElement(RetinaImg, {"name": "sheet-back.png", "mode": (RetinaImg.Mode.ContentIsMask)}),
      React.createElement("div", {"className": "item-back-title"}, (title))
    );
  }

  _onClick() {
    return Actions.popSheet();
  }
}
ToolbarBack.initClass();

class ToolbarWindowControls extends React.Component {
  static initClass() {
    this.displayName = 'ToolbarWindowControls';
  }
  constructor(props) {
    this.componentDidMount = this.componentDidMount.bind(this);
    this.componentWillUnmount = this.componentWillUnmount.bind(this);
    this.render = this.render.bind(this);
    this._onAlt = this._onAlt.bind(this);
    this._onMaximize = this._onMaximize.bind(this);
    this.props = props;
    this.state = {alt: false};
  }

  componentDidMount() {
    if (process.platform === 'darwin') {
      window.addEventListener('keydown', this._onAlt);
      return window.addEventListener('keyup', this._onAlt);
    }
  }

  componentWillUnmount() {
    if (process.platform === 'darwin') {
      window.removeEventListener('keydown', this._onAlt);
      return window.removeEventListener('keyup', this._onAlt);
    }
  }

  render() {
    return React.createElement("div", {"name": "ToolbarWindowControls", "className": `toolbar-window-controls alt-${this.state.alt}`},
      React.createElement("button", {"tabIndex": (-1), "className": "close", "onClick"() { return NylasEnv.close(); }}),
      React.createElement("button", {"tabIndex": (-1), "className": "minimize", "onClick"() { return NylasEnv.minimize(); }}),
      React.createElement("button", {"tabIndex": (-1), "className": "maximize", "onClick": (this._onMaximize)})
    );
  }

  _onAlt(event) {
    if (this.state.alt !== event.altKey) { return this.setState({alt: event.altKey}); }
  }

  _onMaximize(event) {
    if ((process.platform === 'darwin') && !event.altKey) {
      return NylasEnv.setFullScreen(!NylasEnv.isFullScreen());
    } else {
      return NylasEnv.maximize();
    }
  }
}
ToolbarWindowControls.initClass();

class ToolbarMenuControl extends React.Component {
  constructor(...args) {
    this.render = this.render.bind(this);
    this._openMenu = this._openMenu.bind(this);
    super(...args);
  }

  static initClass() {
    this.displayName = 'ToolbarMenuControl';
  }
  render() {
    return React.createElement("div", {"className": "toolbar-menu-control"},
      React.createElement("button", {"tabIndex": (-1), "className": "btn btn-toolbar", "onClick": (this._openMenu)},
        React.createElement(RetinaImg, {"name": "windows-menu-icon.png", "mode": (RetinaImg.Mode.ContentIsMask)})
      )
    );
  }

  _openMenu() {
    const {
      applicationMenu
    } = remote.getGlobal('application');
    return applicationMenu.menu.popup(NylasEnv.getCurrentWindow());
  }
}
ToolbarMenuControl.initClass();

ComponentRegistry.register(ToolbarWindowControls,
  {location: WorkspaceStore.Sheet.Global.Toolbar.Left});

ComponentRegistry.register(ToolbarMenuControl,
  {location: WorkspaceStore.Sheet.Global.Toolbar.Right});

class Toolbar extends React.Component {
  static initClass() {
    this.displayName = 'Toolbar';
  
    this.propTypes = {
      data: PropTypes.object,
      depth: PropTypes.number
    };
  
    this.childContextTypes =
      {sheetDepth: PropTypes.number};
  }
  getChildContext() {
    return {sheetDepth: this.props.depth};
  }

  constructor(props) {
    this.getChildContext = this.getChildContext.bind(this);
    this.componentDidMount = this.componentDidMount.bind(this);
    this.componentWillUnmount = this.componentWillUnmount.bind(this);
    this.UNSAFE_componentWillReceiveProps = this.UNSAFE_componentWillReceiveProps.bind(this);
    this.componentDidUpdate = this.componentDidUpdate.bind(this);
    this.shouldComponentUpdate = this.shouldComponentUpdate.bind(this);
    this.render = this.render.bind(this);
    this._flexboxForComponents = this._flexboxForComponents.bind(this);
    this.recomputeLayout = this.recomputeLayout.bind(this);
    this._onWindowResize = this._onWindowResize.bind(this);
    this._getStateFromStores = this._getStateFromStores.bind(this);
    this.props = props;
    this.state = this._getStateFromStores();
  }

  componentDidMount() {
    this.mounted = true;
    this.unlisteners = [];
    this.unlisteners.push(WorkspaceStore.listen(event => {
      return this.setState(this._getStateFromStores());
    })
    );
    this.unlisteners.push(ComponentRegistry.listen(event => {
      return this.setState(this._getStateFromStores());
    })
    );
    window.addEventListener("resize", this._onWindowResize);
    return window.requestAnimationFrame(() => this.recomputeLayout());
  }

  componentWillUnmount() {
    this.mounted = false;
    window.removeEventListener("resize", this._onWindowResize);
    return Array.from(this.unlisteners).map((unlistener) => unlistener());
  }

  UNSAFE_componentWillReceiveProps(props) {
    return this.setState(this._getStateFromStores(props));
  }

  componentDidUpdate() {
    // Wait for other components that are dirty (the actual columns in the sheet)
    return window.requestAnimationFrame(() => this.recomputeLayout());
  }

  shouldComponentUpdate(nextProps, nextState) {
    // This is very important. Because toolbar uses ReactCSSTransitionGroup,
    // repetitive unnecessary updates can break animations and cause performance issues.
    return !Utils.isEqualReact(nextProps, this.props) || !Utils.isEqualReact(nextState, this.state);
  }

  render() {
    const style = {
      position:'absolute',
      width:'100%',
      height:'100%',
      zIndex: 1
    };

    const toolbars = this.state.columns.map((components, idx) => {
      return React.createElement("div", {"style": ({position: 'absolute', top:0, display:'none'}),  
           "className": `toolbar-${this.state.columnNames[idx]}`,  
           "data-column": (idx),  
           "key": (idx)},
        (this._flexboxForComponents(components))
      );
    });

    return React.createElement("div", { 
      "style": (style),  
      "className": (`sheet-toolbar-container mode-${this.state.mode}`),  
      "data-id": (this.props.data.id)},
      (toolbars)
    );
  }

  _flexboxForComponents(components) {
    const elements = components.map(Component => {
      return React.createElement(Component, Object.assign({"key": (Component.displayName)}, this.props ));
    });

    return React.createElement(Flexbox, {"className": "item-container", "direction": "row"},
      (elements),
      React.createElement(ToolbarSpacer, {"key": "spacer-50", "order": (-50)}),
      React.createElement(ToolbarSpacer, {"key": "spacer+50", "order": (50)})
    );
  }

  recomputeLayout() {
    // Yes this really happens - do not remove!
    if (!this.mounted) { return; }

    // Find our item containers that are tied to specific columns
    const el = ReactDOM.findDOMNode(this);
    const columnToolbarEls = el.querySelectorAll('[data-column]');

    // Find the top sheet in the stack
    const sheet = document.querySelectorAll("[name='Sheet']")[this.props.depth];
    if (!sheet) { return; }

    // Position item containers so they have the position and width
    // as their respective columns in the top sheet
    for (var columnToolbarEl of Array.from(columnToolbarEls)) {
      var {
        column
      } = columnToolbarEl.dataset;
      var columnEl = sheet.querySelector(`[data-column='${column}']`);
      if (!columnEl) { continue; }

      columnToolbarEl.style.display = 'inherit';
      columnToolbarEl.style.left = `${columnEl.offsetLeft}px`;
      columnToolbarEl.style.width = `${columnEl.offsetWidth}px`;
    }

    // Record our overall height for sheets
    return remote.getCurrentWindow().setSheetOffset(el.clientHeight);
  }

  _onWindowResize() {
    return this.recomputeLayout();
  }

  _getStateFromStores(props) {
    let entries, loc;
    if (props == null) { ({
      props
    } = this); }
    const state = {
      mode: WorkspaceStore.layoutMode(),
      columns: [],
      columnNames: []
    };

    // Add items registered to Regions in the current sheet
    if ((this.props.data != null ? this.props.data.columns[state.mode] : undefined) != null) {
      for (loc of Array.from(this.props.data.columns[state.mode])) {
        if (WorkspaceStore.isLocationHidden(loc)) { continue; }
        entries = ComponentRegistry.findComponentsMatching({location: loc.Toolbar, mode: state.mode});
        state.columns.push(entries);
        if (entries) { state.columnNames.push(loc.Toolbar.id.split(":")[0]); }
      }
    }

    // Add left items registered to the Sheet instead of to a Region
    for (loc of [WorkspaceStore.Sheet.Global, this.props.data]) {
      entries = ComponentRegistry.findComponentsMatching({location: loc.Toolbar.Left, mode: state.mode});
      if (state.columns[0] != null) {
        state.columns[0].push(...Array.from(entries || []));
      }
    }
    if (this.props.depth > 0) {
      if (state.columns[0] != null) {
        state.columns[0].push(ToolbarBack);
      }
    }

    // Add right items registered to the Sheet instead of to a Region
    for (loc of [WorkspaceStore.Sheet.Global, this.props.data]) {
      entries = ComponentRegistry.findComponentsMatching({location: loc.Toolbar.Right, mode: state.mode});
      __guard__(state.columns[state.columns.length - 1], x => x.push(...Array.from(entries || [])));
    }
    if (state.mode === "popout") {
      if (state.columns[0] != null) {
        state.columns[0].push(WindowTitle);
      }
    }

    return state;
  }
}
Toolbar.initClass();

module.exports = Toolbar;

function __guard__(value, transform) {
  return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
}