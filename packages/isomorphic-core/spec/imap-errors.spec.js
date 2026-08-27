import {describe, it, expect} from 'vitest';
import {RetryableError} from '../src/errors'
import {
  convertImapError,
  IMAPRetryableError,
  IMAPSocketError,
  IMAPConnectionTimeoutError,
  IMAPAuthenticationError,
  IMAPProtocolError,
  IMAPCertificateError,
  IMAPConnectionNotReadyError,
  IMAPConnectionEndedError,
} from '../src/imap-errors';

const settings = {host: 'imap.example.com'};

describe('convertImapError', () => {
  it('maps retryable message patterns to RetryableError', () => {
    for (const msg of ['Please try again later', 'System error occurred', 'user is authenticated but not connected', 'server unavailable']) {
      const err = convertImapError(new Error(msg), {connectionSettings: settings});
      expect(err, msg).toBeInstanceOf(RetryableError);
    }
  });

  it('maps certificate errors to IMAPCertificateError with the host', () => {
    const err = convertImapError(Object.assign(new Error('self signed certificate in certificate chain'), {code: 'SELF_SIGNED_CERT_IN_CHAIN'}), {connectionSettings: settings});
    expect(err).toBeInstanceOf(IMAPCertificateError);
    expect(err.userMessage).toContain('imap.example.com');
    const byMessage = convertImapError(new Error('unable to verify the first certificate'), {connectionSettings: settings});
    expect(byMessage).toBeInstanceOf(IMAPCertificateError);
  });

  it('maps source fields to specific error classes', () => {
    expect(convertImapError(sourced('socket-timeout'), {connectionSettings: settings})).toBeInstanceOf(IMAPConnectionTimeoutError);
    expect(convertImapError(sourced('timeout'), {connectionSettings: settings})).toBeInstanceOf(IMAPConnectionTimeoutError);
    expect(convertImapError(sourced('socket'), {connectionSettings: settings})).toBeInstanceOf(IMAPSocketError);
    expect(convertImapError(sourced('protocol'), {connectionSettings: settings})).toBeInstanceOf(IMAPProtocolError);
    expect(convertImapError(sourced('authentication'), {connectionSettings: settings})).toBeInstanceOf(IMAPAuthenticationError);
  });

  it('passes through unknown errors untouched (still tagged with source)', () => {
    const err = convertImapError(sourced('mystery'), {connectionSettings: settings});
    expect(err).toBeInstanceOf(Error);
    expect(err.source).toBe('mystery');
  });

  it('ready/ended helpers construct the documented messages', () => {
    expect(() => { throw new IMAPConnectionNotReadyError('IMAPConnection::openBox') }).toThrow(/connect\(\) first/);
    expect(new IMAPConnectionEndedError().message).toContain('ended');
  });
});

function sourced(source) {
  return Object.assign(new Error(`${source} failure`), {source});
}
