/*
 * decaffeinate suggestions:
 * DS002: Fix invalid constructor
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
const React = require("react");
const path = require("path");
const fs = require("fs");
const _ = require("underscore");
const {
	RetinaImg,
	Flexbox,
	ConfigPropContainer,
} = require("nylas-component-kit");
const { AccountStore } = require("nylas-exports");
const OnboardingActions = require("./onboarding-actions").default;

// NOTE: Temporarily copied from preferences module
class AppearanceModeOption extends React.Component {
	constructor(...args) {
		this.render = this.render.bind(this);
		super(...args);
	}

	static initClass() {
		AppearanceModeOption.propTypes = {
			mode: PropTypes.string.isRequired,
			active: PropTypes.bool,
			onClick: PropTypes.func,
		};
	}

	render() {
		let classname = "appearance-mode";
		if (this.props.active) {
			classname += " active";
		}

		const label = {
			list: "Reading Pane Off",
			split: "Reading Pane On",
		}[this.props.mode];

		return React.createElement(
			"div",
			{ className: classname, onClick: this.props.onClick },
			React.createElement(RetinaImg, {
				name: `appearance-mode-${this.props.mode}.png`,
				mode: RetinaImg.Mode.ContentIsMask,
			}),
			React.createElement("div", null, label),
		);
	}
}
AppearanceModeOption.initClass();

class InitialPreferencesOptions extends React.Component {
	static initClass() {
		InitialPreferencesOptions.propTypes = { config: PropTypes.object };
	}

	constructor(props) {
		this._loadTemplates = this._loadTemplates.bind(this);
		this._setConfigDefaultsForAccount =
			this._setConfigDefaultsForAccount.bind(this);
		this.render = this.render.bind(this);
		this.props = props;
		this.state = { templates: [] };
		this._loadTemplates();
	}

	_loadTemplates() {
		const templatesDir = path.join(
			NylasEnv.getLoadSettings().resourcePath,
			"keymaps",
			"templates",
		);
		return fs.readdir(templatesDir, (err, files) => {
			if (!files || !(files instanceof Array)) {
				return;
			}
			let templates = files.filter((filename) => {
				return (
					path.extname(filename) === ".cson" ||
					path.extname(filename) === ".json"
				);
			});
			templates = templates.map((filename) => {
				return path.parse(filename).name;
			});
			this.setState({ templates });
			return this._setConfigDefaultsForAccount(templates);
		});
	}

	_setConfigDefaultsForAccount(templates) {
		if (!this.props.account) {
			return;
		}

		const templateWithBasename = (name) => {
			return _.find(templates, (t) => t.indexOf(name) === 0);
		};

		if (this.props.account.provider === "gmail") {
			this.props.config.set("core.workspace.mode", "list");
			return this.props.config.set(
				"core.keymapTemplate",
				templateWithBasename("Gmail"),
			);
		} else if (
			this.props.account.provider === "eas" ||
			this.props.account.provider === "office365"
		) {
			this.props.config.set("core.workspace.mode", "split");
			return this.props.config.set(
				"core.keymapTemplate",
				templateWithBasename("Outlook"),
			);
		} else {
			this.props.config.set("core.workspace.mode", "split");
			if (process.platform === "darwin") {
				return this.props.config.set(
					"core.keymapTemplate",
					templateWithBasename("Apple Mail"),
				);
			} else {
				return this.props.config.set(
					"core.keymapTemplate",
					templateWithBasename("Outlook"),
				);
			}
		}
	}

	render() {
		if (!this.props.config) {
			return false;
		}

		return React.createElement(
			"div",
			{
				style: {
					display: "flex",
					width: 600,
					marginBottom: 50,
					marginLeft: 150,
					marginRight: 150,
					textAlign: "left",
				},
			},
			React.createElement(
				"div",
				{ style: { flex: 1 } },
				React.createElement(
					"p",
					null,
					`\
Do you prefer a single panel layout (like Gmail)
or a two panel layout?\
`,
				),
				React.createElement(
					Flexbox,
					{ direction: "row", style: { alignItems: "center" } },
					["list", "split"].map((mode) => {
						return React.createElement(AppearanceModeOption, {
							mode: mode,
							key: mode,
							active: this.props.config.get("core.workspace.mode") === mode,
							onClick: () => this.props.config.set("core.workspace.mode", mode),
						});
					}),
				),
			),
			React.createElement("div", {
				key: "divider",
				style: {
					marginLeft: 20,
					marginRight: 20,
					borderLeft: "1px solid #ccc",
				},
			}),
			React.createElement(
				"div",
				{ style: { flex: 1 } },
				React.createElement(
					"p",
					null,
					`\
We've picked a set of keyboard shortcuts based on your email
account and platform. You can also pick another set:\
`,
				),
				React.createElement(
					"select",
					{
						style: { margin: 0 },
						value: this.props.config.get("core.keymapTemplate"),
						onChange: (event) =>
							this.props.config.set("core.keymapTemplate", event.target.value),
					},
					this.state.templates.map((template) => {
						return React.createElement(
							"option",
							{ key: template, value: template },
							template,
						);
					}),
				),
			),
		);
	}
}
InitialPreferencesOptions.initClass();

class InitialPreferencesPage extends React.Component {
	static initClass() {
		InitialPreferencesPage.displayName = "InitialPreferencesPage";
	}

	constructor(props) {
		this.componentDidMount = this.componentDidMount.bind(this);
		this.componentWillUnmount = this.componentWillUnmount.bind(this);
		this._onAccountStoreChange = this._onAccountStoreChange.bind(this);
		this.render = this.render.bind(this);
		this._onFinished = this._onFinished.bind(this);
		this.props = props;
		this.state = { account: AccountStore.accounts()[0] };
	}

	componentDidMount() {
		return (this._unlisten = AccountStore.listen(this._onAccountStoreChange));
	}

	componentWillUnmount() {
		return typeof this._unlisten === "function" ? this._unlisten() : undefined;
	}

	_onAccountStoreChange() {
		return this.setState({ account: AccountStore.accounts()[0] });
	}

	render() {
		return React.createElement(
			"div",
			{ className: "page opaque", style: { width: 900, height: 620 } },
			React.createElement(
				"h1",
				{ style: { paddingTop: 100 } },
				"Welcome to Nylas Mail",
			),
			React.createElement(
				"h4",
				{ style: { marginBottom: 70 } },
				"Let's set things up to your liking.",
			),
			React.createElement(
				ConfigPropContainer,
				null,
				React.createElement(InitialPreferencesOptions, {
					account: this.state.account,
				}),
			),
			React.createElement(
				"button",
				{
					className: "btn btn-large btn-get-started",
					style: { marginBottom: 60 },
					onClick: this._onFinished,
				},
				`\
Looks Good!\
`,
			),
		);
	}

	_onFinished() {
		return require("electron").ipcRenderer.send("account-setup-successful");
	}
}
InitialPreferencesPage.initClass();

module.exports = InitialPreferencesPage;
