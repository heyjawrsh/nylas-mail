import {describe, expect, it, vi} from 'vitest'
import extractFiles from '../../src/message-processor/extract-files.js'

describe('extractFiles', () => {
  it('recurses through structs, decodes names, normalizes content IDs, and deduplicates', async () => {
    const saved = []
    const File = {
      build: vi.fn(values => ({...values, save: vi.fn(async function save() { saved.push(this.id) })})),
    }
    const attachment = {
      type: 'application', subtype: 'pdf', size: 42, partID: '2', encoding: 'base64',
      params: {charset: 'utf-8'}, disposition: {type: 'attachment', params: {filename: 'report.pdf'}},
      id: '<attachment-id>',
    }
    const inline = {
      type: 'image', subtype: 'png', size: 7, partID: '3', encoding: 'binary',
      disposition: {type: 'inline', params: {filename: 'pixel.png'}}, id: 'cid-3',
    }
    const ignoredInline = {
      type: 'text', subtype: 'plain', size: 3, partID: '4',
      disposition: {type: 'inline', params: {}}, id: null,
    }
    const files = await extractFiles({
      db: {File}, messageValues: {id: 'm1', accountId: 'a1'},
      struct: [[attachment, attachment], inline, ignoredInline],
    })

    expect(files).toHaveLength(2)
    expect(files[0]).toMatchObject({
      id: 'm1-2-42', partId: '2', charset: 'utf-8', filename: 'report.pdf',
      contentType: 'application/pdf', contentId: 'attachment-id', messageId: 'm1', accountId: 'a1',
    })
    expect(files[1]).toMatchObject({id: 'm1-3-7', contentId: 'cid-3', contentType: 'image/png'})
    expect(saved).toEqual(['m1-2-42', 'm1-3-7'])
  })

  it('returns an empty list without building or saving files', async () => {
    const File = {build: vi.fn()}
    await expect(extractFiles({
      db: {File}, messageValues: {id: 'm', accountId: 'a'},
      struct: [{type: 'text', subtype: 'plain', size: 5, partID: '1'}],
    })).resolves.toEqual([])
    expect(File.build).not.toHaveBeenCalled()
  })
})
