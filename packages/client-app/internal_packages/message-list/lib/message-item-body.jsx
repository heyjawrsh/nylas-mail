'use strict';

const React = require('react');
const _ = require('underscore');
const EmailFrame = require('./email-frame').default;
const {encodedAttributeForFile} = require('./inline-image-listeners');
const {DraftHelpers, CanvasUtils, NylasAPI, NylasAPIRequest, MessageUtils, MessageBodyProcessor, QuotedHTMLTransformer, FileDownloadStore} = require('nylas-exports');
const {InjectedComponentSet, RetinaImg} = require('nylas-component-kit');
const TransparentPixel = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNikAQAACIAHF/uBd8AAAAASUVORK5CYII=";

class MessageItemBody extends React.Component {
  static displayName = 'MessageItemBody';
  static propTypes = {message: React.PropTypes.object.isRequired, downloads: React.PropTypes.object.isRequired, onLoad: React.PropTypes.func};

  constructor(props) {
    super(props);
    this.componentWillMount = this.componentWillMount.bind(this);
    this.componentDidMount = this.componentDidMount.bind(this);
    this.componentWillUnmount = this.componentWillUnmount.bind(this);
    this.render = this.render.bind(this);
    this._renderBody = this._renderBody.bind(this);
    this._renderQuotedTextControl = this._renderQuotedTextControl.bind(this);
    this._toggleQuotedText = this._toggleQuotedText.bind(this);
    this._mergeBodyWithFiles = this._mergeBodyWithFiles.bind(this);
    this._mounted = false;
    this.state = {showQuotedText: DraftHelpers.isForwardedMessage(this.props.message), processedBody: null};
  }

  componentWillMount() {
    this._unsub = MessageBodyProcessor.subscribe(this.props.message, processedBody => this.setState({processedBody}));
  }
  componentDidMount() { this._mounted = true; }
  componentWillReceiveProps(nextProps) {
    if (nextProps.message.id !== this.props.message.id) {
      if (this._unsub != null) { this._unsub(); }
      this._unsub = MessageBodyProcessor.subscribe(nextProps.message, processedBody => this.setState({processedBody}));
    }
  }
  componentWillUnmount() {
    this._mounted = false;
    if (this._unsub != null) { return this._unsub(); }
  }

  render() {
    return <span>
      <InjectedComponentSet matching={{role: "message:BodyHeader"}} exposedProps={{message: this.props.message}} direction="column" style={{width: '100%'}}/>
      {this._renderBody()}{this._renderQuotedTextControl()}
    </span>;
  }

  _renderBody() {
    if (_.isString(this.props.message.body) && _.isString(this.state.processedBody)) {
      return <EmailFrame showQuotedText={this.state.showQuotedText} content={this._mergeBodyWithFiles(this.state.processedBody)} message={this.props.message} onLoad={this.props.onLoad} />;
    }
    return <div className="message-body-loading"><RetinaImg name="inline-loading-spinner.gif" mode={RetinaImg.Mode.ContentDark} style={{width: 14, height: 14}}/></div>;
  }

  _renderQuotedTextControl() {
    if (!QuotedHTMLTransformer.hasQuotedHTML(this.props.message.body)) { return null; }
    return <a className="quoted-text-control" onClick={this._toggleQuotedText}><span className="dots">&bull;&bull;&bull;</span></a>;
  }
  _toggleQuotedText() { return this.setState({showQuotedText: !this.state.showQuotedText}); }

  _mergeBodyWithFiles(body) {
    for (const file of this.props.message.files) {
      const download = this.props.downloads[file.id];
      if (download && download.state !== 'finished') {
        const inlineImgRegexp = new RegExp(`<\\s*img.*src=['"]cid:${file.contentId}['"][^>]*>`, 'gi');
        body = body.replace(inlineImgRegexp, () => '<img alt="spinner.gif" src="nylas://message-list/assets/spinner.gif" style="-webkit-user-drag: none;">');
      } else {
        const cidRegexp = new RegExp(`cid:${file.contentId}(['"])`, 'gi');
        body = body.replace(cidRegexp, (text, quoteCharacter) => `file://${FileDownloadStore.pathForFile(file)}${quoteCharacter} data-nylas-file="${encodedAttributeForFile(file)}" `);
      }
    }
    body = body.replace(MessageUtils.cidRegex, `src="${TransparentPixel}"`);
    return body;
  }
}

module.exports = MessageItemBody;
