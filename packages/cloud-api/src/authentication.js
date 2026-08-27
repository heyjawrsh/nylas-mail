import {DatabaseConnector} from 'cloud-core';

let db = null // cache this.

export function resetAuthenticationCache() {
  db = null
}

/**
 * This is the validate function for @hapi/basic.
 *
 * API requests are of the form:
 * https://username:pass@n1.nylas.com/some/route
 *
 * The username field is the AccountToken of the N1 Cloud Account (aka
 * email account)
 *
 * The password field is the NylasID token. We no longer check the NylasID
 * token since this creates an unnecessary coupling between the Nylas Mail
 * Cloud APIs and the Redwood Billing database that stores the Nylas ID.
 * Given our usage, a valid account token is sufficient protection against
 * unfettered use of the cloud APIs.
 *
 * Then cb callback param must be called with the signature of:
 * function(err, isValid, credentials)
 */
export async function apiAuthenticate(req, username) {
  const accountToken = username
  if (!db) { db = await DatabaseConnector.forShared() }
  const token = await db.AccountToken.find({where: {value: accountToken}})
  if (!token) return {isValid: false, credentials: {}};
  const account = await token.getAccount();
  req.logger = req.logger.forAccount(account);
  return {isValid: true, credentials: {account}};
}
