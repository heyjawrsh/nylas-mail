'use strict';

const _ = require('underscore');
const React = require("react");
const classnames = require('classnames');
const {Actions, Contact} = require('nylas-exports');
const {Menu, MenuItem} = require('electron').remote;
const MAX_COLLAPSED = 5;

class MessageParticipants extends React.Component {
  static displayName = 'MessageParticipants';
  static propTypes = {to: PropTypes.array, cc: PropTypes.array, bcc: PropTypes.array, from: PropTypes.array, onClick: PropTypes.func, isDetailed: PropTypes.bool};
  static defaultProps = {to: [], cc: [], bcc: [], from: []};

  constructor() {
    super(...arguments);
    this._allToParticipants = this._allToParticipants.bind(this);
    this._selectText = this._selectText.bind(this);
    this._shortNames = this._shortNames.bind(this);
    this._onContactContextMenu = this._onContactContextMenu.bind(this);
    this._renderFullContacts = this._renderFullContacts.bind(this);
    this._renderExpandedField = this._renderExpandedField.bind(this);
    this._renderExpanded = this._renderExpanded.bind(this);
    this._renderCollapsed = this._renderCollapsed.bind(this);
    this.render = this.render.bind(this);
  }

  _allToParticipants() { return _.union(this.props.to, this.props.cc, this.props.bcc); }
  _selectText(e) {
    const textNode = e.currentTarget.childNodes[0];
    const range = document.createRange();
    range.setStart(textNode, 0); range.setEnd(textNode, textNode.length);
    const selection = document.getSelection();
    selection.removeAllRanges(); return selection.addRange(range);
  }
  _shortNames(contacts = [], max = MAX_COLLAPSED) {
    let names = _.map(contacts, c => c.displayName({includeAccountLabel: true, compact: true}));
    if (names.length > max) {
      const extra = names.length - max;
      names = names.slice(0, max); names.push(`and ${extra} more`);
    }
    return names.join(", ");
  }
  _onContactContextMenu(contact) {
    const menu = new Menu();
    menu.append(new MenuItem({role: 'copy'}));
    menu.append(new MenuItem({label: `Email ${contact.email}`, click: () => Actions.composeNewDraftToRecipient(contact)}));
    return menu.popup(NylasEnv.getCurrentWindow());
  }

  _renderFullContacts(contacts = []) {
    return _.map(contacts, (c, i) => {
      const comma = contacts.length === 1 || i === contacts.length - 1 ? "" : ",";
      if ((c.name != null ? c.name.length : undefined) > 0 && c.name !== c.email) {
        return <div key={`${c.email}-${i}`} className="participant selectable">
          <div className="participant-primary" onClick={this._selectText}>{c.fullName()}</div>
          <div className="participant-secondary">{" <"}<span onClick={this._selectText} onContextMenu={() => this._onContactContextMenu(c)}>{c.email}</span>{`>${comma}`}</div>
        </div>;
      }
      return <div key={`${c.email}-${i}`} className="participant selectable"><div className="participant-primary">
        <span onClick={this._selectText} onContextMenu={() => this._onContactContextMenu(c)}>{c.email}</span>{comma}
      </div></div>;
    });
  }

  _renderExpandedField(name, field, {includeLabel = true} = {}) {
    return <div className="participant-type" key={`participant-type-${name}`}>
      {includeLabel ? <div className={`participant-label ${name}-label`}>{name}:&nbsp;</div> : undefined}
      <div className={`participant-name ${name}-contact`}>{this._renderFullContacts(field)}</div>
    </div>;
  }
  _renderExpanded() {
    const expanded = [];
    if (this.props.from.length > 0) { expanded.push(this._renderExpandedField('from', this.props.from, {includeLabel: false})); }
    if (this.props.to.length > 0) { expanded.push(this._renderExpandedField('to', this.props.to)); }
    if (this.props.cc.length > 0) { expanded.push(this._renderExpandedField('cc', this.props.cc)); }
    if (this.props.bcc.length > 0) { expanded.push(this._renderExpandedField('bcc', this.props.bcc)); }
    return <div className="expanded-participants">{expanded}</div>;
  }
  _renderCollapsed() {
    const childSpans = [];
    const toParticipants = this._allToParticipants();
    if (this.props.from.length > 0) { childSpans.push(<span className="participant-name from-contact" key="from">{this._shortNames(this.props.from)}</span>); }
    if (toParticipants.length > 0) {
      childSpans.push(<span className="participant-label to-label" key="to-label">To:&nbsp;</span>);
      childSpans.push(<span className="participant-name to-contact" key="to-value">{this._shortNames(toParticipants)}</span>);
    }
    return <span className="collapsed-participants">{childSpans}</span>;
  }
  render() {
    const classSet = classnames({participants: true, "message-participants": true, collapsed: !this.props.isDetailed, "from-participants": this.props.from.length > 0, "to-participants": this._allToParticipants().length > 0});
    return <div className={classSet} onClick={this.props.onClick}>{this.props.isDetailed ? this._renderExpanded() : this._renderCollapsed()}</div>;
  }
}

module.exports = MessageParticipants;
