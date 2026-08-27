import {parseContacts, getReplyHeaders, getMailerPayload} from '../src/message-utils';

describe('MessageUtilsHelpers', () => {
  it('does not erroneously split contact names on commas', () => {
    expect(parseContacts(['"Little Bo Peep, The Hill" <bopeep@example.com>'])).toEqual([
      {name: 'Little Bo Peep, The Hill', email: 'bopeep@example.com'},
    ]);
  });

  it('extracts multiple contacts and preserves unicode', () => {
    expect(parseContacts(['AppleBees Zé <a@example.com>, "Tiger Zen" b@example.com'])).toEqual([
      {name: 'AppleBees Zé', email: 'a@example.com'},
      {name: 'Tiger Zen', email: 'b@example.com'},
    ]);
  });

  it('concatenates contacts from multiple header lines', () => {
    expect(parseContacts([
      'Yubi Key <yubi@example.com>',
      'Smokey the Bear <smokey@example.com>',
    ])).toEqual([
      {name: 'Yubi Key', email: 'yubi@example.com'},
      {name: 'Smokey the Bear', email: 'smokey@example.com'},
    ]);
  });

  it('returns no contacts for empty input', () => {
    expect(parseContacts()).toEqual([]);
    expect(parseContacts([])).toEqual([]);
  });

  it('builds reply headers in reference order', () => {
    expect(getReplyHeaders({
      headerMessageId: '<latest@example.com>',
      references: [{id: 'a', rfc2822MessageId: '<first@example.com>'}],
      referencesOrder: ['a'],
    })).toEqual({
      inReplyTo: '<latest@example.com>',
      references: ['<first@example.com>', '<latest@example.com>'],
    });
  });

  it('builds a nodemailer payload', () => {
    const payload = getMailerPayload({
      from: [{name: 'Sender', email: 'sender@example.com'}],
      to: [{name: 'Recipient', email: 'recipient@example.com'}],
      subject: 'Hello',
      body: '<p>Hello</p>',
      date: new Date('2020-01-01T00:00:00Z'),
      headerMessageId: '<message@example.com>',
    });
    expect(payload.from).toBe('Sender <sender@example.com>');
    expect(payload.to).toBe('Recipient <recipient@example.com>');
    expect(payload.headers['User-Agent']).toBe('NylasMailer-K2');
  });
});
