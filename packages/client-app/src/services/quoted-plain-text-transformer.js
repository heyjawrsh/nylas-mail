/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
const _ = require('underscore');
const _str = require('underscore.string');

// Parses plain text emails to find quoted text and signatures.
//
// For plain text emails we look for lines that look like they're quoted
// text based on common conventions:
//
// For HTML emails use QuotedHTMLTransformer
//
// This is modied from https://github.com/mko/emailreplyparser, which is a
// JS port of GitHub's Ruby https://github.com/github/email_reply_parser
const QuotedPlainTextParser = {
  parse(text) {
    const parsedEmail = new ParsedEmail;
    return parsedEmail.parse(text);
  },

  visibleText(text, param) {
    if (param == null) { param = {}; }
    let {showQuoted, showSignature} = param;
    if (showQuoted == null) { showQuoted = false; }
    if (showSignature == null) { showSignature = false; }
    return this.parse(text).visibleText({showQuoted, showSignature});
  },

  hiddenText(text, param) {
    if (param == null) { param = {}; }
    let {showQuoted, showSignature} = param;
    if (showQuoted == null) { showQuoted = false; }
    if (showSignature == null) { showSignature = false; }
    return this.parse(text).hiddenText({showQuoted, showSignature});
  },

  hasQuotedHTML(text) {
    return this.parse(text).hasQuotedHTML();
  }
};

const chomp = function() {
  return this.replace(/(\n|\r)+$/, '');
};

// An ParsedEmail instance contains various `Fragment`s that indicate if we
// think a section of text is quoted or is a signature
class ParsedEmail {
  static initClass() {
  
    this.prototype.fragments = [];
  
    this.prototype._signatureRE =
      /(--|__|^-\w)|(^sent from my (\s*\w+){1,3}$)/i;
  }
  constructor() {
    this.fragments = [];
    this.currentFragment = null;
  }

  hasQuotedHTML() {
    for (var fragment of Array.from(this.fragments)) {
      if (fragment.quoted) { return true; }
    }
    return false;
  }

  visibleText(param) {
    if (param == null) { param = {}; }
    const {showSignature, showQuoted} = param;
    this._setHiddenState({showSignature, showQuoted});
    return _.reject(this.fragments, f => f.hidden).map(f => f.to_s()).join('\n');
  }

  hiddenText(param) {
    if (param == null) { param = {}; }
    const {showSignature, showQuoted} = param;
    this._setHiddenState({showSignature, showQuoted});
    return _.filter(this.fragments, f => f.hidden).map(f => f.to_s()).join('\n');
  }

  // We set a hidden state just so we can test the expected output in our
  // specs. The hidden state is determined by the requested view parameters
  // and the `quoted` flag on each `fragment`
  _setHiddenState(param) {
    if (param == null) { param = {}; }
    const {showSignature, showQuoted} = param;
    const fragments = _.reject(this.fragments, function(f) {
      if (f.to_s().trim() === "") {
        f.hidden = true;
        return true;
      } else { return false; }
    });

    return (() => {
      const result = [];
      for (let i = 0; i < fragments.length; i++) {
        var fragment = fragments[i];
        fragment.hidden = true;
        if (fragment.quoted) {
          if (showQuoted || ((fragments[i+1] != null) && !(fragments[i+1].quoted || fragments[i+1].signature))) {
            fragment.hidden = false;
            continue;
          } else { continue; }
        }

        if (fragment.signature) {
          if (showSignature) {
            fragment.hidden = false;
            continue;
          } else { continue; }
        }

        result.push(fragment.hidden = false);
      }
      return result;
    })();
  }

  parse(text) {

    // This instance variable points to the current Fragment.  If the matched
    // line fits, it should be added to this Fragment.  Otherwise, finish it
    // and start a new Fragment.
    this.currentFragment = null;
    return this._parsePlain(text);
  }

  _parsePlain(text) {
    // Check for multi-line reply headers. Some clients break up
    // the "On DATE, NAME <EMAIL> wrote:" line into multiple lines.
    const patt = /^(On\s(\n|.)*wrote:)$/m;
    const doubleOnPatt = /^(On\s(\n|.)*(^(> )?On\s)((\n|.)*)wrote:)$/m;
    if (patt.test(text) && !doubleOnPatt.test(text)) {
      const replyHeader = patt.exec(text)[0];
      // Remove all new lines from the reply header.
      text = text.replace(replyHeader, replyHeader.replace(/\n/g, ' '));
    }

    // The text is reversed initially due to the way we check for hidden
    // fragments.
    text = _str.reverse(text);

    // Use the StringScanner to pull out each line of the email content.
    const lines = text.split('\n');

    for (var i in lines) {
      this._scanPlainLine(lines[i]);
    }

    // Finish up the final fragment.  Finishing a fragment will detect any
    // attributes (hidden, signature, reply), and join each line into a
    // string.
    this._finishFragment();

    // Now that parsing is done, reverse the order.
    this.fragments.reverse();

    return this;
  }

  // NOTE: Plain lines are scanned bottom to top. We reverse the text in
  // `_parsePlain`
  _scanPlainLine(line) {
    line = chomp.apply(line);

    if (!new RegExp(this._signatureRE).test(_str.reverse(line))) {
      line = _str.ltrim(line);
    }

    // Mark the current Fragment as a signature if the current line is ''
    // and the Fragment starts with a common signature indicator.
    if ((this.currentFragment !== null) && (line === '')) {
      if (new RegExp(this._signatureRE).test(_str.reverse(this.currentFragment.lines[this.currentFragment.lines.length - 1]))) {
        this.currentFragment.signature = true;
        this._finishFragment();
      }
    }

    // We're looking for leading `>`'s to see if this line is part of a
    // quoted Fragment.
    const isQuoted = new RegExp('(>+)$').test(line);

    // If the line matches the current fragment, add it.  Note that a common
    // reply header also counts as part of the quoted Fragment, even though
    // it doesn't start with `>`.
    if ((this.currentFragment !== null) && ((this.currentFragment.quoted === isQuoted) || (this.currentFragment.quoted && (this._quoteHeader(line) || (line === ''))))) {
      this.currentFragment.lines.push(line);
    } else {
      this._finishFragment();
      this.currentFragment = new Fragment(isQuoted, line, "plain");
    }
  }

  _quoteHeader(line) {
    return new RegExp('^:etorw.*nO$').test(line);
  }

  _finishFragment() {
    if (this.currentFragment !== null) {
      this.currentFragment.finish();
      this.fragments.push(this.currentFragment);
      this.currentFragment = null;
    }
  }
}
ParsedEmail.initClass();

// Represents a group of paragraphs in the email sharing common attributes.
// Paragraphs should get their own fragment if they are a quoted area or a
// signature.
class Fragment {
  static initClass() {
  
    this.prototype.content = null;
  }
  constructor(quoted, firstLine) {
    this.quoted = quoted;
    this.signature = false;
    this.hidden = false;
    this.lines = [ firstLine ];
    this.content = null;
    this.lines = this.lines.filter(() => true);
  }

  finish() {
    this.content = this.lines.join("\n");
    this.lines = [];

    this.content = _str.reverse(this.content);

  }

  to_s() {
    return this.content.toString().trim();
  }
}
Fragment.initClass();

module.exports = QuotedPlainTextParser;
