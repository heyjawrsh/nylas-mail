import {describe, expect, it, vi} from 'vitest'
import registerLoggerDecorator from '../src/decorators/logger'
import registerErrorFormatDecorator from '../src/decorators/error-format'

describe('decorators', () => {
  it('registers an applied request logger', () => {
    const decorate = vi.fn(); registerLoggerDecorator({decorate})
    expect(decorate).toHaveBeenCalledWith('request', 'logger', expect.any(Function), {apply: true})
  })
  it('reformats Boom responses before continuing', () => {
    let extension; registerErrorFormatDecorator({ext: (_name, fn) => { extension = fn }})
    const reformat = vi.fn(); const h = {continue: Symbol('continue')}
    expect(extension({response: {isBoom: true, reformat}}, h)).toBe(h.continue)
    expect(reformat).toHaveBeenCalled()
    expect(extension({response: {}}, h)).toBe(h.continue)
  })
})
