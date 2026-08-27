// Translators between the legacy node-imap call shapes used across
// client-sync and imapflow's current query DSL. Pure functions — unit-tested
// in spec/imap-translators.spec.js.

/**
 * Convert a node-imap search criteria array into an imapflow search query
 * object. Supported forms (everything client-sync emits):
 *
 *   'SEEN' | 'UNSEEN'
 *   ['HEADER', 'Field-Name', 'value']
 *   ['FROM'|'TO'|'SUBJECT'|'TEXT', 'text']
 *   ['UID', '1:500']
 *   ['X-GM-RAW', 'gmail query']
 *   ['OR', criteria, criteria]
 *   [criteria, criteria, ...] (implicit AND — top level)
 *
 * @param {Array|string} criteria
 * @returns {Object} imapflow search query
 */
export function criteriaToSearchQuery(criteria) {
  if (criteria == null) {
    return {}
  }
  if (typeof criteria === 'string') {
    return _singleCriterion(criteria)
  }
  if (!Array.isArray(criteria)) {
    throw new Error(`criteriaToSearchQuery: unsupported criteria ${JSON.stringify(criteria)}`)
  }
  // ['OR', a, b]
  if (criteria[0] === 'OR') {
    return {or: [criteriaToSearchQuery(criteria[1]), criteriaToSearchQuery(criteria[2])]}
  }
  // A single criterion wrapped in an array (the form the query compiler
  // emits): ['HEADER', field, value], ['FROM', text], ['SEEN'], ...
  if (typeof criteria[0] === 'string') {
    return _singleCriterion(criteria)
  }
  // A list of criteria — implicit AND at the top level
  return _mergeAnd(criteria.map((c) => criteriaToSearchQuery(c)))
}

function _singleCriterion(criterion) {
  if (Array.isArray(criterion) && criterion.length === 1 && typeof criterion[0] === 'string') {
    return _singleCriterion(criterion[0])
  }
  if (typeof criterion === 'string') {
    switch (criterion) {
      case 'SEEN':
        return {seen: true}
      case 'UNSEEN':
        return {seen: false}
      case 'ALL':
        return {}
      default:
        throw new Error(`criteriaToSearchQuery: unsupported bare criterion '${criterion}'`)
    }
  }
  const [key, ...rest] = criterion
  switch (key) {
    case 'HEADER': {
      const [field, value] = rest
      return {header: {[field]: value}}
    }
    case 'FROM':
    case 'TO':
    case 'SUBJECT':
    case 'TEXT':
      return {[key.toLowerCase()]: rest[0]}
    case 'UID':
      return {uid: String(rest[0])}
    case 'X-GM-RAW':
      return {gmailRaw: String(rest[0])}
    case 'OR':
      return {or: [criteriaToSearchQuery(rest[0]), criteriaToSearchQuery(rest[1])]}
    default:
      throw new Error(`criteriaToSearchQuery: unsupported criterion key '${key}'`)
  }
}

function _mergeAnd(queries) {
  const merged = {}
  for (const q of queries) {
    for (const [k, v] of Object.entries(q)) {
      if (k === 'header' && merged.header) {
        Object.assign(merged.header, v)
      } else if (k === 'or' && merged.or) {
        merged.or = merged.or.concat(v)
      } else {
        merged[k] = v
      }
    }
  }
  return merged
}

/**
 * Translate imapflow's parsed bodyStructure (object tree) into the legacy
 * node-imap "struct" shape consumed by client-sync's MIME walkers:
 *
 *  - a multipart node is an Array whose elements are its children, with the
 *    node's own metadata attached as array properties (type is the SUBTYPE,
 *    e.g. 'alternative', plus params/disposition/size where present)
 *  - a leaf is an object {partID, type, subtype, params, disposition,
 *    encoding, size, lines, id, description}
 *
 * @param {Object} node imapflow bodyStructure node
 * @returns {Object|Array} legacy struct node
 */
export function imapflowStructToLegacy(node) {
  if (!node) {
    return node
  }
  if (Array.isArray(node)) {
    // imapflow never returns arrays here, but be forgiving.
    return node.map(imapflowStructToLegacy)
  }
  const isMultipart = (node.type || '').toLowerCase() === 'multipart' || (node.childNodes && node.childNodes.length)
  if (isMultipart) {
    const children = (node.childNodes || []).map(imapflowStructToLegacy)
    const container = children.slice()
    container.type = node.subtype ? node.subtype.toLowerCase() : 'mixed'
    if (node.parameters) container.params = node.parameters
    if (node.disposition) container.disposition = node.disposition
    return container
  }
  return {
    partID: node.part,
    type: node.type ? node.type.toLowerCase() : undefined,
    subtype: node.subtype ? node.subtype.toLowerCase() : undefined,
    params: node.parameters,
    id: node.id,
    description: node.description,
    encoding: node.encoding,
    size: node.size,
    lines: node.lines,
    disposition: node.disposition
      ? {type: (node.disposition.type || '').toLowerCase(), params: node.disposition.params}
      : undefined,
  }
}

/**
 * Split a fetched body item spec into an imapflow fetch query fragment.
 * Legacy body specs seen in the codebase:
 *   'HEADER'                         -> full headers
 *   'HEADER.FIELDS (FROM TO ...)'    -> header subset
 *   'TEXT'                           -> body text (the raw source minus headers)
 *   '1.2' / '2' / '2.MIME'           -> specific MIME part
 *
 * @param {string} spec
 * @returns {{query: Object, key: string}} query fragment and the key the
 *   response content should be filed under in the legacy `parts` map.
 */
export function bodySpecToFetchQuery(spec) {
  if (typeof spec !== 'string') {
    throw new Error(`bodySpecToFetchQuery: spec must be a string, got ${typeof spec}`)
  }
  if (spec === 'HEADER') {
    return {query: {headers: true}, key: 'HEADER'}
  }
  if (spec === 'TEXT') {
    return {query: {source: true}, key: 'TEXT'}
  }
  const headerFields = spec.match(/^HEADER\.FIELDS\s*\((.*)\)$/i)
  if (headerFields) {
    const fields = headerFields[1].trim().split(/\s+/)
    return {query: {headers: fields}, key: spec.toUpperCase()}
  }
  // A MIME part id ('1', '1.2', '2.MIME')
  return {query: {bodyParts: [spec]}, key: spec.toUpperCase()}
}

/**
 * Decode a base64 XOAUTH2 SASL string ("user=...\x01auth=Bearer TOKEN\x01\x01")
 * into {user, accessToken}.
 */
export function decodeXOAuth2String(xoauth2) {
  const raw = Buffer.from(xoauth2, 'base64').toString('utf8')
  const match = raw.match(/^user=(.+)\x01auth=Bearer (.+)\x01\x01$/)
  if (!match) {
    throw new Error('decodeXOAuth2String: malformed XOAUTH2 string')
  }
  return {user: match[1], accessToken: match[2]}
}
