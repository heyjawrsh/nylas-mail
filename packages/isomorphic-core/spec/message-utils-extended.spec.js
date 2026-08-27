import {afterEach, describe, expect, it, vi} from 'vitest';
import {buildForSend, buildMime, getMailerPayload, parseContacts, parseSnippet} from '../src/message-utils.js';

afterEach(() => vi.unstubAllGlobals());

describe('extended message helpers', () => {
  it('handles missing and address-only contacts', () => {
    expect(parseContacts([null])).toEqual([]);
    expect(parseContacts(['plain@example.com'])).toEqual([{name: '', email: 'plain@example.com'}]);
    expect(parseContacts(['', 'ignored@example.com'])).toEqual([]);
  });

  it('extracts snippet text while rejecting hidden nodes and spacing block nodes', () => {
    const ELEMENT = 1;
    const TEXT = 3;
    const nodes = [
      {nodeType: ELEMENT, nodeName: 'P', tagName: 'P'},
      {nodeType: TEXT, nodeValue: ' Hello '},
      {nodeType: ELEMENT, nodeName: 'STRONG', tagName: 'STRONG'},
      {nodeType: TEXT, nodeValue: 'world'},
      {nodeType: ELEMENT, nodeName: 'SCRIPT', tagName: 'SCRIPT'},
      {nodeType: TEXT, nodeValue: 'ignored'},
      {nodeType: ELEMENT, nodeName: 'DIV', tagName: 'DIV'},
      {nodeType: TEXT, nodeValue: ' next\n line '},
    ];
    vi.stubGlobal('Node', {ELEMENT_NODE: ELEMENT, TEXT_NODE: TEXT});
    vi.stubGlobal('NodeFilter', {SHOW_ELEMENT: 1, SHOW_TEXT: 4, FILTER_REJECT: 2, FILTER_ACCEPT: 1, FILTER_SKIP: 3});
    vi.stubGlobal('DOMParser', class { parseFromString() { return {}; } });
    vi.stubGlobal('document', {createTreeWalker(_doc, _what, filter) {
      const accepted = nodes.filter((node) => filter(node) === 1 && node.tagName !== 'SCRIPT' && node.nodeValue !== 'ignored');
      let index = -1;
      return {currentNode: null, nextNode() { index += 1; this.currentNode = accepted[index]; return Boolean(this.currentNode); }};
    }});
    expect(parseSnippet('<p>ignored by fake parser</p>')).toBe('Hello world next line');
  });

  it('builds a new outgoing message and activates tracking links', async () => {
    const built = {id: null};
    const Message = {
      buildHeaderMessageId: vi.fn(() => '<header@example.com>'),
      dateString: vi.fn(() => 'DATE'),
      hash: vi.fn(() => 'hashed-id'),
      build: vi.fn(({id}) => Object.assign(built, {id})),
    };
    const db = {Thread: {findOne: vi.fn()}, Message, Reference: {}};
    const result = await buildForSend(db, {
      account_id: 'a', client_id: 'client', from: [], to: [], cc: [], bcc: [], reply_to: [],
      subject: 'Subject', body: '<img data-open-tracking-src="https://x/MESSAGE_ID">', draft: true, uploads: [],
    });
    expect(result).toBe(built);
    expect(result).toMatchObject({id: 'hashed-id', accountId: 'a', threadId: null, headerMessageId: '<header@example.com>', isDraft: true});
    expect(result.body).toContain('src="https://x/hashed-id"');
  });

  it('builds reply headers from a message and validates thread membership', async () => {
    const reply = {
      id: 'm1', headerMessageId: '<m1@example.com>', references: null, referencesOrder: [],
      getThread: vi.fn(async () => ({id: 'thread'})),
    };
    const Message = {
      findByPk: vi.fn(async () => reply), buildHeaderMessageId: () => '<new>', dateString: () => 'DATE',
      hash: () => 'new-id', build: ({id}) => ({id}),
    };
    const thread = {id: 'wrong', messages: [{id: 'other'}]};
    const db = {Thread: {findOne: vi.fn(async () => thread)}, Message, Reference: {}};
    const json = {thread_id: 'wrong', reply_to_message_id: 'm1', client_id: 'c', body: '', from: [], to: []};
    await expect(buildForSend(db, json)).rejects.toMatchObject({statusCode: 400});
    thread.messages.push({id: 'm1'});
    const result = await buildForSend(db, json);
    expect(result).toMatchObject({threadId: 'thread', inReplyToLocalMessageId: 'm1', inReplyTo: '<m1@example.com>', references: ['<m1@example.com>']});
  });

  it('formats all mailer fields, attachments, custom headers and Bcc MIME', async () => {
    const message = {
      from: [{name: 'from@example.com', email: 'from@example.com'}],
      to: [{name: 'To', email: 'to@example.com'}], cc: [], bcc: [{name: 'Blind', email: 'b@example.com'}],
      replyTo: [{name: 'Reply', email: 'reply@example.com'}], subject: 'Subject', body: '<p>Body</p>',
      date: new Date('2024-01-01Z'), message_id_header: '<fallback>', inReplyTo: '<old>', references: ['<older>'],
      uploads: [{filename: 'résumé.pdf', targetPath: '/definitely/not/read-until-streamed', inline: true, id: 'cid'}],
      headers: {'X-Test': 'yes'},
    };
    const payload = getMailerPayload(message);
    expect(payload.from).toBe('from example.com <from@example.com>');
    expect(payload.replyTo).toBe('Reply <reply@example.com>');
    expect(payload.attachments[0]).toMatchObject({cid: 'cid'});
    expect(payload.headers).toMatchObject({'X-Test': 'yes', 'User-Agent': 'NylasMailer-K2'});
    expect(payload.messageId).toBe('<fallback>');

    const mimeMessage = {...message, uploads: []};
    await expect(buildMime(mimeMessage)).resolves.not.toMatch(/^Bcc:/);
    await expect(buildMime(mimeMessage, {includeBcc: true})).resolves.toMatch(/^Bcc: Blind <b@example.com>/);
  });
});
