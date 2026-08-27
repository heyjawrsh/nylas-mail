/*
 * decaffeinate suggestions:
 * DS002: Fix invalid constructor
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
let KeyManager;
const {Utils, React, Actions} = require('nylas-exports');
const PGPKeyStore = require('./pgp-key-store');
const KeybaseUser = require('./keybase-user');
const PassphrasePopover = require('./passphrase-popover');
const kb = require('./keybase');
const _ = require('underscore');
const pgp = require('kbpgp');
const fs = require('fs');

module.exports =
(KeyManager = (function() {
  KeyManager = class KeyManager extends React.Component {
    static initClass() {
      this.displayName = 'KeyManager';
  
      this.propTypes = {
        pubKeys: React.PropTypes.array.isRequired,
        privKeys: React.PropTypes.array.isRequired
      };
    }

    constructor(props) {
      this._exportPopoverDone = this._exportPopoverDone.bind(this);
      this._exportPrivateKey = this._exportPrivateKey.bind(this);
      super(props);
    }

    _exportPopoverDone(passphrase, identity) {
      // check the passphrase before opening the save dialog
      return fs.readFile(identity.keyPath, (err, data) => {
        return pgp.KeyManager.import_from_armored_pgp({
          armored: data
        }, (err, km) => {
          if (err) {
            return console.warn(err);
          } else {
            return km.unlock_pgp({ passphrase }, err => {
              if (err) {
                return PGPKeyStore._displayError(err);
              } else {
                return PGPKeyStore.exportKey({identity, passphrase});
              }
          });
          }
      });
      });
    }

    _exportPrivateKey(identity, event) {
      const popoverTarget = event.target.getBoundingClientRect();

      return Actions.openPopover(
        <PassphrasePopover identity={identity} addresses={identity.addresses} onPopoverDone={ this._exportPopoverDone } />,
        {originRect: popoverTarget, direction: 'left'}
      );
    }

    render() {
      let {pubKeys, privKeys} = this.props;

      pubKeys = pubKeys.map(identity => {
        const deleteButton = (<button title="Delete Public" className="btn btn-toolbar btn-danger" onClick={() => PGPKeyStore.deleteKey(identity) } ref="button">
        Delete Key
      </button>
        );
        const exportButton = (<button title="Export Public" className="btn btn-toolbar" onClick={() => PGPKeyStore.exportKey({identity: identity}) } ref="button">
        Export Key
      </button>
        );
        const actionButton = (<div className="key-actions">
        {exportButton}
        {deleteButton}
      </div>
        );
        return <KeybaseUser profile={identity} key={identity.clientId} actionButton={actionButton}/>;
      });

      privKeys = privKeys.map(identity => {
        const deleteButton = (<button title="Delete Private" className="btn btn-toolbar btn-danger" onClick={() => PGPKeyStore.deleteKey(identity) } ref="button">
        Delete Key
      </button>
        );
        const exportButton = (<button title="Export Private" className="btn btn-toolbar" onClick={ (event) => this._exportPrivateKey(identity, event) } ref="button">
        Export Key
      </button>
        );
        const actionButton = (<div className="key-actions">
        {exportButton}
        {deleteButton}
      </div>
        );
        return <KeybaseUser profile={identity} key={identity.clientId} actionButton={actionButton}/>;
      });

      return <div className="key-manager">
      <div className="line-w-label">
        <div className="border"></div>
        <div className="title-text">Saved Public Keys</div>
        <div className="border"></div>
      </div>
      <div>
        { pubKeys }
      </div>
      <div className="line-w-label">
        <div className="border"></div>
        <div className="title-text">Saved Private Keys</div>
        <div className="border"></div>
      </div>
      <div>
        { privKeys }
      </div>
    </div>;
    }
  };
  KeyManager.initClass();
  return KeyManager;
})());
