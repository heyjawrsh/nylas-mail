/*
 * decaffeinate suggestions:
 * DS002: Fix invalid constructor
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
const { React, RegExpUtils } = require("nylas-exports");
const PGPKeyStore = require("./pgp-key-store");
const KeybaseSearch = require("./keybase-search");
const KeyManager = require("./key-manager");
const KeyAdder = require("./key-adder");

class PreferencesKeybase extends React.Component {
	static initClass() {
		PreferencesKeybase.displayName = "PreferencesKeybase";
	}

	constructor(props) {
		super();
		this.componentDidMount = this.componentDidMount.bind(this);
		this.componentWillUnmount = this.componentWillUnmount.bind(this);
		this._onChange = this._onChange.bind(this);
		this.render = this.render.bind(this);
		this.props = props;
		this._keySaveQueue = {};

		const { pubKeys, privKeys } = this._getStateFromStores();
		this.state = {
			pubKeys,
			privKeys,
		};
	}

	componentDidMount() {
		return (this.unlistenKeystore = PGPKeyStore.listen(this._onChange, this));
	}

	componentWillUnmount() {
		return this.unlistenKeystore();
	}

	_onChange() {
		return this.setState(this._getStateFromStores());
	}

	_getStateFromStores() {
		const pubKeys = PGPKeyStore.pubKeys();
		const privKeys = PGPKeyStore.privKeys({ timed: false });
		return { pubKeys, privKeys };
	}

	render() {
		const noKeysMessage = (
			<div className="key-status-bar no-keys-message">
				You have no saved PGP keys!
			</div>
		);

		const keyManager = (
			<KeyManager pubKeys={this.state.pubKeys} privKeys={this.state.privKeys} />
		);

		return (
			<div className="container-keybase">
				<section className="key-add">
					<KeyAdder />
				</section>
				<section className="keybase">
					<KeybaseSearch inPreferences={true} />
					{this.state.pubKeys.length === 0 && this.state.privKeys.length === 0
						? noKeysMessage
						: keyManager}
				</section>
			</div>
		);
	}
}
PreferencesKeybase.initClass();

module.exports = PreferencesKeybase;
