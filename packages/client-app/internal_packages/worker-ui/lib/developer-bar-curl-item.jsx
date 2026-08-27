/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
const classNames = require('classnames');
const React = require('react');

class DeveloperBarCurlItem extends React.Component {
  constructor(...args) {
    super(...args);
    this.render = this.render.bind(this);
    this.shouldComponentUpdate = this.shouldComponentUpdate.bind(this);
    this._onCopyCommand = this._onCopyCommand.bind(this);
    this._onRunCommand = this._onRunCommand.bind(this);
  }

  static initClass() {
    this.displayName = 'DeveloperBarCurlItem';
  }

  render() {
    const classes = classNames({
      "item": true,
      "error-code": this._isError()
    });
    return <div className={classes}>
      <div className="code">{this.props.item.statusCode}{this._errorMessage()}</div>
      <span className="timestamp">{this.props.item.startMoment.format("HH:mm:ss")}&nbsp;&nbsp;</span>
      <a onClick={this._onRunCommand}>Run</a>
      <a onClick={this._onCopyCommand}>Copy</a>
      {this.props.item.command}
    </div>;
  }

  shouldComponentUpdate(nextProps) {
    return this.props.item !== nextProps.item;
  }

  _onCopyCommand() {
    const {
      clipboard
    } = require('electron');
    return clipboard.writeText(this.props.item.commandWithAuth);
  }

  _isError() {
    if (this.props.item.statusCode === "pending") { return false; }
    return !(parseInt(this.props.item.statusCode) <= 399);
  }

  _errorMessage() {
    if ((this.props.item.errorMessage != null ? this.props.item.errorMessage : "").length > 0) {
      return ` | ${this.props.item.errorMessage}`;
    } else {
      return "";
    }
  }

  _onRunCommand() {
    const curlFile = `${NylasEnv.getConfigDirPath()}/curl.command`;
    const fs = require('fs-plus');
    if (fs.existsSync(curlFile)) {
      fs.unlinkSync(curlFile);
    }
    fs.writeFileSync(curlFile, this.props.item.commandWithAuth);
    fs.chmodSync(curlFile, '777');
    const {shell} = require('electron');
    return shell.openItem(curlFile);
  }
}
DeveloperBarCurlItem.initClass();


module.exports = DeveloperBarCurlItem;
