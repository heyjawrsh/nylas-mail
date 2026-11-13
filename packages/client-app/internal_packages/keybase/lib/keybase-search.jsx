/*
 * decaffeinate suggestions:
 * DS002: Fix invalid constructor
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
import PropTypes from "prop-types";
let KeybaseSearch;
const {
	Utils,
	React,
	Actions,
	RegExpUtils,
	IdentityStore,
	AccountStore,
} = require("nylas-exports");
const { RetinaImg } = require("nylas-component-kit");
const EmailPopover = require("./email-popover");
const PGPKeyStore = require("./pgp-key-store");
const KeybaseUser = require("../lib/keybase-user");
const Identity = require("./identity");
const kb = require("./keybase");
const _ = require("underscore");

module.exports = KeybaseSearch = (() => {
	KeybaseSearch = class KeybaseSearch extends React.Component {
		static initClass() {
			KeybaseSearch.displayName = "KeybaseSearch";

			KeybaseSearch.propTypes = {
				initialSearch: PropTypes.string,
				// importFunc: a alternate function to execute when the "import" button is
				// clicked instead of the "please specify an email" popover
				importFunc: PropTypes.func,
				// TODO consider just passing in a pre-specified email instead of a func?
				inPreferences: PropTypes.bool,
			};

			KeybaseSearch.defaultProps = {
				initialSearch: "",
				importFunc: null,
				inPreferences: false,
			};
		}

		constructor(props) {
			super(props);
			this._importKey = this._importKey.bind(this);
			this._popoverDone = this._popoverDone.bind(this);
			this._save = this._save.bind(this);
			this._queryChange = this._queryChange.bind(this);
			this.state = {
				query: props.initialSearch,
				results: [],
				loading: false,
				searchedByEmail: false,
			};

			this.debouncedSearch = _.debounce(this._search, 300);
		}

		componentDidMount() {
			return this._search();
		}

		UNSAFE_componentWillReceiveProps(props) {
			return this.setState({ query: props.initialSearch });
		}

		_search() {
			const oldquery = this.state.query;
			if (this.state.query !== "" && this.state.loading === false) {
				this.setState({ loading: true });
				return kb.autocomplete(this.state.query, (_error, profiles) => {
					if (profiles != null) {
						profiles = _.map(
							profiles,
							(profile) =>
								new Identity({ keybase_profile: profile, isPriv: false }),
						);
						this.setState({ results: profiles, loading: false });
					} else {
						this.setState({ results: [], loading: false });
					}
					if (this.state.query !== oldquery) {
						return this.debouncedSearch();
					}
				});
			} else {
				// no query - empty out the results
				return this.setState({ results: [] });
			}
		}

		_importKey(profile, event) {
			// opens a popover requesting user to enter 1+ emails to associate with a
			// key - a button in the popover then calls _save to actually import the key
			const popoverTarget = event.target.getBoundingClientRect();

			return Actions.openPopover(
				<EmailPopover profile={profile} onPopoverDone={this._popoverDone} />,
				{ originRect: popoverTarget, direction: "left" },
			);
		}

		_popoverDone(addresses, identity) {
			if (addresses.length < 1) {
				// no email addresses added, noop
				return;
			} else {
				identity.addresses = addresses;
				// TODO validate the addresses?
				return this._save(identity);
			}
		}

		_save(identity) {
			// save/import a key from keybase
			const keybaseUsername = identity.keybase_profile.components.username.val;

			return kb.getKey(keybaseUsername, (error, key) => {
				if (error) {
					return console.error(error);
				} else {
					return PGPKeyStore.saveNewKey(identity, key);
				}
			});
		}

		_queryChange(event) {
			const emailQuery = RegExpUtils.emailRegex().test(event.target.value);
			this.setState({ query: event.target.value, searchedByEmail: emailQuery });
			return this.debouncedSearch();
		}

		render() {
			let profiles = _.map(this.state.results, (profile) => {
				// allow for overriding the import function
				let boundFunc;
				if (typeof this.props.importFunc === "function") {
					boundFunc = this.props.importFunc;
				} else {
					boundFunc = this._importKey;
				}

				const saveButton = (
					<button
						title="Import"
						className="btn btn-toolbar"
						onClick={(event) => boundFunc(profile, event)}
					>
						Import Key
					</button>
				);

				// TODO improved deduping? tricky because of the kbprofile - email association
				if (profile.keyPath == null) {
					return <KeybaseUser profile={profile} actionButton={saveButton} />;
				}
			});

			if (profiles == null || profiles.length < 1) {
				profiles = [];
			}

			let badSearch = null;
			let loading = null;
			const empty = null;

			if (profiles.length < 1 && this.state.searchedByEmail) {
				badSearch = (
					<span className="bad-search-msg">
						Keybase cannot be searched by email address. <br />
						Try entering a name, or a username from GitHub, Keybase or Twitter.
					</span>
				);
			}

			if (this.state.loading) {
				loading = (
					<RetinaImg
						style={{ width: 20, height: 20, marginTop: 2 }}
						name="inline-loading-spinner.gif"
						mode={RetinaImg.Mode.ContentPreserve}
					/>
				);
			}

			return (
				<div className="keybase-search">
					<div className="searchbar">
						<input
							type="text"
							value={this.state.query}
							placeholder="Search for PGP public keys on Keybase"
							onChange={this._queryChange}
						/>
						{empty}
						<div className="loading">{loading}</div>
					</div>
					<div className="results">
						{profiles}
						{badSearch}
					</div>
				</div>
			);
		}
	};
	KeybaseSearch.initClass();
	return KeybaseSearch;
})();
