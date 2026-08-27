'use strict';

/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
const _ = require('underscore');
const path = require('path');

const {FileDownloadStore} = require('nylas-exports');

const Actions = require('../actions').default;
const DatabaseStore = require('./database-store').default;
const AccountStore = require('./account-store').default;
const ContactStore = require('./contact-store');
const MessageStore = require('./message-store');
const FocusedPerspectiveStore = require('./focused-perspective-store').default;

let DraftStore = null;
const DraftHelpers = require('./draft-helpers').default;

const Thread = require('../models/thread').default;
const Contact = require('../models/contact').default;
const Message = require('../models/message').default;
const Utils = require('../models/utils');

const {subjectWithPrefix} = require('../models/utils');
const DOMUtils = require('../../dom-utils');

class DraftFactory {
  constructor() {
    this.createDraft = this.createDraft.bind(this);
    this.createDraftForMailto = this.createDraftForMailto.bind(this);
    this.createOrUpdateDraftForReply = this.createOrUpdateDraftForReply.bind(this);
    this.createDraftForReply = this.createDraftForReply.bind(this);
    this.createDraftForForward = this.createDraftForForward.bind(this);
    this.candidateDraftForUpdating = this.candidateDraftForUpdating.bind(this);
    this.updateDraftForReply = this.updateDraftForReply.bind(this);
    this._fromContactForReply = this._fromContactForReply.bind(this);
    this._accountForNewDraft = this._accountForNewDraft.bind(this);
  }

  createDraft(fields) {
    if (fields == null) { fields = {}; }
    const account = this._accountForNewDraft();
    return Promise.resolve(new Message(_.extend({
      body: '',
      subject: '',
      clientId: Utils.generateTempId(),
      from: [account.defaultMe()],
      date: (new Date),
      draft: true,
      pristine: true,
      accountId: account.id
    }, fields)));
  }

  createDraftForMailto(urlString) {
    const account = this._accountForNewDraft();

    try {
      urlString = decodeURI(urlString);
    } catch (error) {}

    let match = /mailto:\/*([^\?\&]*)((.|\n|\r)*)/.exec(urlString);
    if (!match) {
      return Promise.reject(new Error(`${urlString} is not a valid mailto URL.`));
    }

    let [whole, to, queryString] = Array.from(match);

    if ((to.length > 0) && (to.indexOf('@') === -1)) {
      to = decodeURIComponent(to);
    }

    // /many/ mailto links are malformed and do things like:
    //   &body=https://github.com/atom/electron/issues?utf8=&q=is%3Aissue+is%3Aopen+123&subject=...
    //   (note the unescaped ? and & in the URL).
    //
    // To account for these scenarios, we parse the query string manually and only
    // split on params we expect to be there. (Jumping from &body= to &subject=
    // in the above example.) We only decode values when they appear to be entirely
    // URL encoded. (In the above example, decoding the body would cause the URL
    // to fall apart.)
    //
    const query = {};
    query.to = to;

    const querySplit = /[&|?](subject|body|cc|to|from|bcc)+\s*=/gi;

    let openKey = null;
    let openValueStart = null;

    while (match !== null) {
      match = querySplit.exec(queryString);
      var openValueEnd = (match != null ? match.index : undefined) || queryString.length;

      if (openKey) {
        var value = queryString.substr(openValueStart, openValueEnd - openValueStart);
        var valueIsntEscaped = (value.indexOf('?') !== -1) || (value.indexOf('&') !== -1);
        try {
          if (!valueIsntEscaped) { value = decodeURIComponent(value); }
        } catch (error1) {}
        query[openKey] = value;
      }

      if (match) {
        openKey = match[1].toLowerCase();
        openValueStart = querySplit.lastIndex;
      }
    }

    const contacts = {};
    for (var attr of ['to', 'cc', 'bcc']) {
      if (query[attr]) {
        contacts[attr] = ContactStore.parseContactsInString(query[attr]);
      }
    }

    if (query.body) {
      query.body = query.body.replace(/[\n\r]/g, '<br/>');
    }

    return Promise.props(contacts).then(contacts => {
      return this.createDraft(_.extend(query, contacts));
    });
  }

  createOrUpdateDraftForReply({message, thread, type, behavior}) {
    if (!['reply', 'reply-all'].includes(type)) {
      throw new Error(`createOrUpdateDraftForReply called with ${type}, not reply or reply-all`);
    }

    return this.candidateDraftForUpdating(message, behavior).then(existingDraft => {
      if (existingDraft) {
        return this.updateDraftForReply(existingDraft, {message, thread, type});
      } else {
        return this.createDraftForReply({message, thread, type});
      }
    });
  }

  createDraftForReply({message, thread, type}) {
    let cc, to;
    if (type === 'reply') {
      ({to, cc} = message.participantsForReply());
    } else if (type === 'reply-all') {
      ({to, cc} = message.participantsForReplyAll());
    }

    return this.createDraft({
      subject: subjectWithPrefix(message.subject, 'Re:'),
      to,
      cc,
      from: [this._fromContactForReply(message)],
      threadId: thread.id,
      accountId: message.accountId,
      replyToMessageId: message.id,
      body: "" // quoted html is managed by the composer via the replyToMessageId
    });
  }

  createDraftForForward({thread, message}) {
    // Start downloading the attachments, if they haven't been already
    message.files.forEach(f => Actions.fetchFile(f));

    const contactsAsHtml = cs => DOMUtils.escapeHTMLCharacters(_.invoke(cs, "toString").join(", "));
    const fields = [];
    if (message.from.length > 0) { fields.push(`From: ${contactsAsHtml(message.from)}`); }
    fields.push(`Subject: ${message.subject}`);
    fields.push(`Date: ${message.formattedDate()}`);
    if (message.to.length > 0) { fields.push(`To: ${contactsAsHtml(message.to)}`); }
    if (message.cc.length > 0) { fields.push(`Cc: ${contactsAsHtml(message.cc)}`); }

    return DraftHelpers.prepareBodyForQuoting(message.body).then(body => {
      return this.createDraft({
        subject: subjectWithPrefix(message.subject, 'Fwd:'),
        from: [this._fromContactForReply(message)],
        threadId: thread.id,
        accountId: message.accountId,
        body: `\
<br><br>
<div class="gmail_quote">
  <br>
  ---------- Forwarded message ---------
  <br><br>
  ${fields.join('<br>')}
  <br><br>
  ${body}
</div>`
      }).then(draft => {
        draft.uploads = message.files.map(f => {
          const {fileId, filename, filesize, targetPath} = FileDownloadStore.getDownloadDataForFile(f.id);
          // Return an object that can act as an Upload instance.
          return {
            messageClientId: draft.clientId,
            id: fileId,
            filename,
            size: filesize,
            targetPath,
            targetDir: path.dirname(targetPath)
          };
        });
        return draft;
      });
    });
  }


  candidateDraftForUpdating(message, behavior) {
    if (!['prefer-existing-if-pristine', 'prefer-existing'].includes(behavior)) {
      return Promise.resolve(null);
    }

    let getMessages = DatabaseStore.findAll(Message, {threadId: message.threadId});
    if (message.threadId === MessageStore.threadId()) {
      getMessages = Promise.resolve(MessageStore.items());
    }

    return getMessages.then(messages => {
      const candidateDrafts = messages.filter(other => {
        return (other.replyToMessageId === message.id) && (other.draft === true);
      });

      if (candidateDrafts.length === 0) {
        return Promise.resolve(null);
      }

      if (behavior === 'prefer-existing') {
        return Promise.resolve(candidateDrafts.pop());

      } else if (behavior === 'prefer-existing-if-pristine') {
        if (DraftStore == null) { DraftStore = require('./draft-store').default; }
        return Promise.all(candidateDrafts.map(candidateDraft => {
          return DraftStore.sessionForClientId(candidateDraft.clientId);
        })).then(sessions => {
          for (var session of Array.from(sessions)) {
            if (session.draft().pristine) {
              return Promise.resolve(session.draft());
            }
          }
          return Promise.resolve(null);
        });
      }
    });
  }


  updateDraftForReply(draft, {type, message}) {
    let key, targetSet;
    if (!message || !draft) {
      return Promise.reject("updateDraftForReply: Expected message and existing draft.");
    }

    const updated = {to: [].concat(draft.to), cc: [].concat(draft.cc)};
    const replySet = message.participantsForReply();
    const replyAllSet = message.participantsForReplyAll();

    if (type === 'reply') {
      targetSet = replySet;

      // Remove participants present in the reply-all set and not the reply set
      for (key of ['to', 'cc']) {
        updated[key] = _.reject(updated[key], function(contact) {
          const inReplySet = _.findWhere(replySet[key], {email: contact.email});
          const inReplyAllSet = _.findWhere(replyAllSet[key], {email: contact.email});
          return inReplyAllSet && !inReplySet;
        });
      }
    } else {
      // Add participants present in the reply-all set and not on the draft
      // Switching to reply-all shouldn't really ever remove anyone.
      targetSet = replyAllSet;
    }

    for (key of ['to', 'cc']) {
      for (var contact of Array.from(targetSet[key])) {
        if (!_.findWhere(updated[key], {email: contact.email})) { updated[key].push(contact); }
      }
    }

    draft.to = updated.to;
    draft.cc = updated.cc;

    return DatabaseStore.inTransaction(t => {
      return t.persistModel(draft);
  }).thenReturn(draft);
  }

  _fromContactForReply(message) {
    const account = AccountStore.accountForId(message.accountId);
    const defaultMe = account.defaultMe();
    let result = defaultMe;

    for (var aliasString of Array.from(account.aliases)) {
      var alias = account.meUsingAlias(aliasString);
      for (var recipient of Array.from([].concat(message.to, message.cc))) {
        var emailIsNotDefault = alias.email !== defaultMe.email;
        var emailsMatch = recipient.email === alias.email;
        var nameIsNotDefault = alias.name !== defaultMe.name;
        var namesMatch = recipient.name === alias.name;

        // No better match is possible
        if (emailsMatch && emailIsNotDefault && namesMatch && nameIsNotDefault) {
          return alias;
        }

        // A better match is possible. eg: the user may have two aliases with the same
        // email but different phrases, and we'll get an exact match on the other one.
        // Continue iterating and wait to see.
        if ((emailsMatch && emailIsNotDefault) || (namesMatch && nameIsNotDefault)) {
          result = alias;
        }
      }
    }

    return result;
  }

  _accountForNewDraft() {
    const defAccountId = NylasEnv.config.get('core.sending.defaultAccountIdForSend');
    const account = AccountStore.accountForId(defAccountId);
    if (account) {
      return account;
    } else {
      const focusedAccountId = FocusedPerspectiveStore.current().accountIds[0];
      if (focusedAccountId) {
        return AccountStore.accountForId(focusedAccountId);
      } else {
        return AccountStore.accounts()[0];
      }
    }
  }
}

module.exports = new DraftFactory();
