import {describe, expect, it} from 'vitest';
import {
  convertSmtpError, SMTPAuthenticationError, SMTPCertificateError,
  SMTPConnectionDNSError, SMTPConnectionEndedError, SMTPConnectionTLSError,
  SMTPConnectionTimeoutError, SMTPProtocolError,
} from '../src/smtp-errors.js';

describe('convertSmtpError', () => {
  it.each([
    ['Connection timeout', SMTPConnectionTimeoutError, 408],
    ['connect ETIMEDOUT', SMTPConnectionTimeoutError, 408],
    ['Error initiating TLS', SMTPConnectionTLSError, 408],
    ['getaddrinfo ENOTFOUND smtp.invalid', SMTPConnectionDNSError, 401],
    ['unknown protocol', SMTPProtocolError, 401],
    ['Invalid login', SMTPAuthenticationError, 401],
    ['username and password not accepted', SMTPAuthenticationError, 401],
    ['authentication failed', SMTPAuthenticationError, 401],
  ])('maps %s', (message, Klass, statusCode) => {
    const result = convertSmtpError(new Error(message));
    expect(result).toBeInstanceOf(Klass);
    expect(result.statusCode).toBe(statusCode);
    expect(result.userMessage).toBeTruthy();
  });

  it('includes the SMTP host for certificate failures', () => {
    const coded = Object.assign(new Error('failure'), {code: 'SELF_SIGNED_CERT_IN_CHAIN'});
    const result = convertSmtpError(coded, {connectionSettings: {host: 'smtp.example.com'}});
    expect(result).toBeInstanceOf(SMTPCertificateError);
    expect(result.userMessage).toContain('smtp.example.com');
    expect(convertSmtpError(new Error('certificate expired'))).toBeInstanceOf(SMTPCertificateError);
  });

  it('preserves unknown errors', () => {
    const error = new Error('surprising response');
    expect(convertSmtpError(error)).toBe(error);
  });

  it('documents the current connection-closed conversion failure', () => {
    const error = Object.assign(new Error('socket closed'), {code: 'ECONNECTION'});
    expect(() => convertSmtpError(error)).toThrow(TypeError);
    expect(new SMTPConnectionEndedError('ended')).toBeInstanceOf(Error);
  });
});
