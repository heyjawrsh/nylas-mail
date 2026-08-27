import {describe, it, expect} from 'vitest';
import {
  criteriaToSearchQuery,
  imapflowStructToLegacy,
  bodySpecToFetchQuery,
  decodeXOAuth2String,
} from '../src/imap-translators';

describe('criteriaToSearchQuery', () => {
  it('maps bare flag strings', () => {
    expect(criteriaToSearchQuery('SEEN')).toEqual({seen: true});
    expect(criteriaToSearchQuery('UNSEEN')).toEqual({seen: false});
    expect(criteriaToSearchQuery('ALL')).toEqual({});
  });

  it('maps header criteria', () => {
    expect(criteriaToSearchQuery([['HEADER', 'Message-ID', '<a@b>']]))
      .toEqual({header: {'Message-ID': '<a@b>'}});
  });

  it('merges multiple header criteria into one header map', () => {
    expect(criteriaToSearchQuery([['HEADER', 'From', 'x'], ['HEADER', 'Subject', 'y']]))
      .toEqual({header: {From: 'x', Subject: 'y'}});
  });

  it('maps text field criteria lowercase', () => {
    expect(criteriaToSearchQuery([['FROM', 'jarvis']])).toEqual({from: 'jarvis'});
    expect(criteriaToSearchQuery([['SUBJECT', 'hello']])).toEqual({subject: 'hello'});
    expect(criteriaToSearchQuery([['TEXT', 'needle']])).toEqual({text: 'needle'});
  });

  it('maps uid ranges as strings', () => {
    expect(criteriaToSearchQuery([['UID', '1:500']])).toEqual({uid: '1:500'});
    expect(criteriaToSearchQuery([['UID', `1:${500}`]])).toEqual({uid: '1:500'});
  });

  it('maps gmail raw searches', () => {
    expect(criteriaToSearchQuery([['X-GM-RAW', 'in:inbox OR in:sent']]))
      .toEqual({gmailRaw: 'in:inbox OR in:sent'});
  });

  it('maps nested OR', () => {
    expect(criteriaToSearchQuery([['OR', ['UNSEEN'], ['FROM', 'boss']]]))
      .toEqual({or: [{seen: false}, {from: 'boss'}]});
  });

  it('AND-merges top-level criteria', () => {
    expect(criteriaToSearchQuery([['UNSEEN'], ['FROM', 'x']]))
      .toEqual({seen: false, from: 'x'});
  });

  it('rejects unknown criteria keys loudly', () => {
    expect(() => criteriaToSearchQuery([['XMAIL', 'wat']])).toThrow(/XMAIL/);
  });
});

describe('imapflowStructToLegacy', () => {
  const imapflowStructure = {
    type: 'multipart',
    subtype: 'MIXED',
    childNodes: [
      {
        part: '1',
        type: 'text',
        subtype: 'PLAIN',
        parameters: {charset: 'utf-8'},
        encoding: 'quoted-printable',
        size: 100,
      },
      {
        part: '2',
        type: 'TEXT',
        subtype: 'HTML',
        parameters: {charset: 'utf-8'},
        disposition: {type: 'INLINE'},
        encoding: 'base64',
        size: 200,
      },
    ],
  };

  it('produces node-imap style containers: arrays with metadata properties', () => {
    const legacy = imapflowStructToLegacy(imapflowStructure);
    expect(Array.isArray(legacy)).toBe(true);
    expect(legacy.type).toBe('mixed'); // subtype lowered, attached to container
    expect(legacy).toHaveLength(2);
  });

  it('leaf nodes carry partID/type/subtype/params/encoding/size', () => {
    const legacy = imapflowStructToLegacy(imapflowStructure);
    const leaf = legacy[0];
    expect(leaf.partID).toBe('1');
    expect(leaf.type).toBe('text');
    expect(leaf.subtype).toBe('plain');
    expect(leaf.params).toEqual({charset: 'utf-8'});
    expect(leaf.encoding).toBe('quoted-printable');
    expect(leaf.size).toBe(100);
    expect(legacy[1].disposition.type).toBe('inline');
  });

  it('walks deep alternative trees the client-sync walker expects', () => {
    const alternative = {
      type: 'multipart',
      subtype: 'ALTERNATIVE',
      childNodes: imapflowStructure.childNodes,
    };
    const legacy = imapflowStructToLegacy(alternative);
    expect(legacy.type).toBe('alternative');
    // The walker checks part[0].type for arrays
    expect(typeof legacy[0].type).toBe('string');
  });

  it('passes null through', () => {
    expect(imapflowStructToLegacy(null)).toBeNull();
  });
});

describe('bodySpecToFetchQuery', () => {
  it('maps full headers', () => {
    expect(bodySpecToFetchQuery('HEADER')).toEqual({query: {headers: true}, key: 'HEADER'});
  });

  it('maps header field subsets, preserving the key casing contract', () => {
    const {query, key} = bodySpecToFetchQuery('HEADER.FIELDS (FROM TO SUBJECT)');
    expect(query.headers).toEqual(['FROM', 'TO', 'SUBJECT']);
    expect(key).toBe('HEADER.FIELDS (FROM TO SUBJECT)');
  });

  it('maps TEXT to a source fetch', () => {
    expect(bodySpecToFetchQuery('TEXT')).toEqual({query: {source: true}, key: 'TEXT'});
  });

  it('maps MIME part ids', () => {
    expect(bodySpecToFetchQuery('1.2')).toEqual({query: {bodyParts: ['1.2']}, key: '1.2'});
  });

  it('rejects non-string specs', () => {
    expect(() => bodySpecToFetchQuery(42)).toThrow();
  });
});

describe('decodeXOAuth2String', () => {
  it('decodes user and access token from the SASL string', () => {
    const token = Buffer.from('user=someone@example.com\x01auth=Bearer ya29.token\x01\x01').toString('base64');
    expect(decodeXOAuth2String(token)).toEqual({
      user: 'someone@example.com',
      accessToken: 'ya29.token',
    });
  });

  it('throws on malformed input', () => {
    expect(() => decodeXOAuth2String('not-a-token')).toThrow(/malformed/);
  });
});
