import {Transform} from 'stream'
import libmime from 'libmime';

export class QuotedPrintableStreamDecoder extends Transform {
  constructor(opts = {}) {
    super(opts);
    this.charset = opts.charset
    this._text = "";
  }

  /**
   * Overrides Transform::_transfor
   *
   * We can't decode quoted-printable in chunks, so we buffer it.
   */
  _transform = (chunk, encoding, cb) => {
    this._text += chunk.toString();
    cb();
  }

  /**
   * Overrides Transform::_flush
   *
   * At the end of the stream, decode the whole buffer at once and flush
   * it out the end.
   */
  _flush = (cb) => {
    // If this.charset is null (a very common case for attachments),
    // libmime defaults to utf-8 as the charset.
    this.push(libmime.decodeQuotedPrintable(this._text, this.charset));
    cb();
  }
}
