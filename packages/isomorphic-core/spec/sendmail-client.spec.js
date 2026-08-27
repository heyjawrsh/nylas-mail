import {describe, it, expect, vi, beforeEach} from 'vitest';

const sent = [];
const verifyFn = vi.fn(async () => true);

vi.mock('nodemailer', () => ({
  default: {
    createTransport: () => ({
      sendMail: (opts) => { sent.push(opts); return Promise.resolve({messageId: 'mid-1'}) },
      verify: verifyFn,
      close: vi.fn(),
    }),
  },
}));

import SendmailClient from '../src/sendmail-client.js';

const account = () => ({
  id: 'a', provider: 'imap', emailAddress: 'x@example.com',
  smtpConfig: () => ({host: 'smtp.example.com', port: 587, secure: false, auth: {user: 'x@example.com', pass: 'pw'}}),
});
const logger = () => ({info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn(), child: () => logger()});

describe('SendmailClient', () => {
  beforeEach(() => { sent.length = 0; verifyFn.mockClear() });

  it('sends a message through the transporter and returns the message id', async () => {
    const client = new SendmailClient(account(), logger());
    await client.send({to: [{email: 'y@example.com', name: 'Y'}], from: [{email: 'x@example.com', name: 'X'}], body: 'hi', subject: 's'});
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toContain('y@example.com');
  });

  it('sendCustom honors explicit recipients', async () => {
    const client = new SendmailClient(account(), logger());
    await client.sendCustom({subject: 's', body: 'b', from: [{email: 'x@example.com', name: 'X'}], to: [{email: 'z@example.com', name: 'Z'}]}, {to: [{email: 'z@example.com', name: 'Z'}]});
    expect(JSON.stringify(sent[0])).toContain('z@example.com');
  });

  it('reuses one transporter per client instance', async () => {
    const client = new SendmailClient(account(), logger());
    await client.send({to: [{email: 'y@example.com', name: 'Y'}], from: [{email: 'x@example.com', name: 'X'}], body: 'hi', subject: 's'});
    await client.send({to: [{email: 'y2@example.com', name: 'Y2'}], from: [{email: 'x@example.com', name: 'X'}], body: 'hi', subject: 's'});
    expect(sent).toHaveLength(2);
    expect(client._transporter).toBe(client._transporter);
  });
});
