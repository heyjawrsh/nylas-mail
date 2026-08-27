import {describe, expect, it} from 'vitest'
import {decodeRecipient} from '../src/tracking-utils'
describe('decodeRecipient', () => {
  it('prefers the readable parameter', () => expect(decodeRecipient({recipient: 'a@b.com', r: 'ignored'})).toBe('a@b.com'))
  it('decodes legacy base64 and missing values', () => {
    expect(decodeRecipient({r: 'YUBiLmNvbQ=='})).toBe('a@b.com')
    expect(decodeRecipient()).toBeNull()
  })
})
