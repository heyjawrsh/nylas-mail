import {beforeEach, describe, expect, it, vi} from 'vitest'
const mocks = vi.hoisted(() => {
  class IMAPAuthenticationError extends Error {}
  class IMAPAuthenticationTimeoutError extends Error {}
  class IMAPConnectionTimeoutError extends Error {}
  return {
    forShared: vi.fn(), newClient: vi.fn(), exchange: vi.fn(), profile: vi.fn(),
    resolve: vi.fn(), createAccount: vi.fn(), pending: vi.fn(), refresh: vi.fn(),
    imapHandler: vi.fn(), upsert: vi.fn(),
    IMAPAuthenticationError, IMAPAuthenticationTimeoutError, IMAPConnectionTimeoutError,
  };
})
vi.mock('cloud-core', () => ({DatabaseConnector: {forShared: mocks.forShared}, GmailOAuthHelpers: {newOAuthClient: mocks.newClient, exchangeCodeForGoogleToken: mocks.exchange, fetchGoogleProfile: mocks.profile, resolveIMAPSettings: mocks.resolve, createCloudAccount: mocks.createAccount, createPendingAuthResponse: mocks.pending, refreshAccessToken: mocks.refresh}}))
vi.mock('isomorphic-core', () => ({AuthHelpers: {imapAuthRouteConfig: () => ({}), imapAuthHandler: mocks.imapHandler, googleSettings: (token, email) => ({token, email}), generateXOAuth2Token: (email, token) => `${email}:${token}`}, IMAPErrors: {IMAPAuthenticationError: mocks.IMAPAuthenticationError, IMAPAuthenticationTimeoutError: mocks.IMAPAuthenticationTimeoutError, IMAPConnectionTimeoutError: mocks.IMAPConnectionTimeoutError}}))
import registerAuthRoutes from '../src/routes/auth'
import {getMockServer, getToolkit} from './helpers'

describe('OAuth routes', () => {
  let routes, logger
  beforeEach(() => {
    vi.clearAllMocks(); const server = getMockServer(); registerAuthRoutes(server); routes = Object.fromEntries(server.routes.map(route => [route.path, route]))
    logger = {debug: vi.fn(), error: vi.fn(), child: vi.fn(() => ({error: vi.fn()}))}
  })
  it('redirects to the generated Google authorization URL and boomifies errors', async () => {
    const generateAuthUrl = vi.fn().mockReturnValue('https://google/auth'); mocks.newClient.mockReturnValue({generateAuthUrl})
    expect((await routes['/auth/gmail'].handler({query: {state: 's'}, logger}, getToolkit())).location).toBe('https://google/auth')
    expect(generateAuthUrl).toHaveBeenCalledWith(expect.objectContaining({state: 's'}))
    mocks.newClient.mockImplementationOnce(() => { throw new Error('bad') })
    expect((await routes['/auth/gmail'].handler({query: {state: 's'}, logger}, getToolkit())).isBoom).toBe(true)
  })
  it('completes the OAuth callback', async () => {
    mocks.newClient.mockReturnValue({}); mocks.exchange.mockResolvedValue({access: 't'}); mocks.profile.mockResolvedValue({email: 'a@b.com'}); mocks.resolve.mockResolvedValue({host: 'imap'}); mocks.createAccount.mockResolvedValue({emailAddress: 'a@b.com'})
    const result = await routes['/auth/gmail/oauthcallback'].handler({query: {state: 'n-----key', code: 'c'}, logger}, getToolkit())
    expect(result.template).toBe('gmail-auth-success'); expect(mocks.pending).toHaveBeenCalled()
  })
  it.each([
    ['access denied', new Error('denied'), 'access_denied', 'access_denied'],
    ['imap authentication', new mocks.IMAPAuthenticationError('auth'), undefined, 'imap_auth_error'],
    ['timeout', new mocks.IMAPConnectionTimeoutError('timeout'), undefined, 'auth_timeout'],
    ['invalid grant', new Error('invalid_grant token'), undefined, 'invalid_grant'],
    ['unknown', new Error('other'), undefined, undefined],
  ])('renders the %s callback failure', async (_name, error, queryError, flag) => {
    mocks.newClient.mockReturnValue({}); mocks.exchange.mockRejectedValue(error)
    const result = await routes['/auth/gmail/oauthcallback'].handler({query: {state: 'n-----key', code: 'c', error: queryError}, logger}, getToolkit())
    expect(result.template).toBe('gmail-auth-failure'); if (flag) expect(result.context[flag]).toBe(true)
  })
  it('polls, consumes, and validates pending auth responses', async () => {
    const destroy = vi.fn(); const find = vi.fn().mockResolvedValue({response: {token: 't'}, destroy}); mocks.forShared.mockResolvedValue({PendingAuthResponse: {find}})
    expect(await routes['/auth/gmail/token'].handler({query: {key: 'k'}, logger})).toEqual({token: 't'}); expect(destroy).toHaveBeenCalled()
    find.mockResolvedValueOnce(null); expect((await routes['/auth/gmail/token'].handler({query: {key: 'k'}, logger})).output.statusCode).toBe(404)
    find.mockResolvedValueOnce({destroy}); expect((await routes['/auth/gmail/token'].handler({query: {key: 'k'}, logger})).output.statusCode).toBe(500)
    find.mockRejectedValueOnce(new Error('db')); expect((await routes['/auth/gmail/token'].handler({query: {key: 'k'}, logger})).output.statusCode).toBe(404)
  })
  it('refreshes access tokens and returns a controlled error', async () => {
    const request = {auth: {credentials: {account: {emailAddress: 'a@b.com'}}}, logger}
    mocks.refresh.mockResolvedValue({access_token: 't', expiry_date: 9000})
    expect(await routes['/auth/gmail/refresh'].handler(request, getToolkit())).toEqual({access_token: 't', xoauth2: 'a@b.com:t', expiry_date: 9})
    mocks.refresh.mockRejectedValueOnce(new Error('bad')); expect((await routes['/auth/gmail/refresh'].handler(request, getToolkit())).statusCode).toBe(400)
  })
})
