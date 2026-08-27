/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS104: Avoid inline assignments
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
// This file is in coffeescript just to use the existential operator!
let ClearbitDataSource;
const {AccountStore} = require('nylas-exports');

const MAX_RETRY = 10;

module.exports = (ClearbitDataSource = class ClearbitDataSource {
  constructor() {
    this.parseResponse = this.parseResponse.bind(this);
  }

  clearbitAPI() {
    return "https://person.clearbit.com/v2/combined";
  }

  find({email, tryCount}) {
    // TODO: If you have a Clearbit API key, insert the request to clearbit here!
    return Promise.resolve({});
  }

  // The clearbit -> Nylas adapater
  parseResponse(body, statusCode, requestedEmail, tryCount) {
    if (body == null) { body = {}; }
    if (tryCount == null) { tryCount = 0; }
    return new Promise((resolve, reject) => {
      // This means it's in the process of fetching. Return null so we don't
      // cache and try again.
      let left;
      if (statusCode === 202) {
        setTimeout(() => {
          return this.find({email: requestedEmail, tryCount: tryCount+1}).then(resolve).catch(reject);
        }
        , 1000);
        return;
      } else if (statusCode !== 200) {
        resolve(null);
        return;
      }

      let {
        person
      } = body;

      // This means there was no data about the person available. Return a
      // valid, but empty object for us to cache. This can happen when we
      // have company data, but no personal data.
      if (!person) {
        person = {email: requestedEmail};
      }

      return resolve({
        cacheDate: Date.now(),
        email: requestedEmail, // Used as checksum
        bio: (left = person.bio != null ? person.bio : (person.twitter != null ? person.twitter.bio : undefined)) != null ? left : (person.aboutme != null ? person.aboutme.bio : undefined),
        location: person.location != null ? person.location : (person.geo != null ? person.geo.city : undefined),
        currentTitle: (person.employment != null ? person.employment.title : undefined),
        currentEmployer: (person.employment != null ? person.employment.name : undefined),
        profilePhotoUrl: person.avatar,
        rawClearbitData: body,
        socialProfiles: this._socialProfiles(person)
      });
    });
  }

  _socialProfiles(person) {
    if (person == null) { person = {}; }
    const profiles = {};
    if (((person.twitter != null ? person.twitter.handle : undefined) != null ? (person.twitter != null ? person.twitter.handle : undefined) : "").length > 0) {
      profiles.twitter = {
        handle: person.twitter.handle,
        url: `https://twitter.com/${person.twitter.handle}`
      };
    }
    if (((person.facebook != null ? person.facebook.handle : undefined) != null ? (person.facebook != null ? person.facebook.handle : undefined) : "").length > 0) {
      profiles.facebook = {
        handle: person.facebook.handle,
        url: `https://facebook.com/${person.facebook.handle}`
      };
    }
    if (((person.linkedin != null ? person.linkedin.handle : undefined) != null ? (person.linkedin != null ? person.linkedin.handle : undefined) : "").length > 0) {
      profiles.linkedin = {
        handle: person.linkedin.handle,
        url: `https://linkedin.com/${person.linkedin.handle}`
      };
    }

    return profiles;
  }
});
