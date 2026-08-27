import {
  ACCOUNT_ID,
  destroyTestDatabase,
  mockImapBox,
  getTestDatabase,
} from '../helpers'
import IMAPHelpers from '../../src/local-sync-worker/imap-helpers'

describe('IMAPHelpers', function describeBlock() {
  let db, sentLabel, l1, l2, l3, m1, m2, m3, messages, box
  describe('setLabelsForMessages', () => {
    beforeEach(async () => {
      destroyTestDatabase()
      db = await getTestDatabase()
      sentLabel = await db.Label.create({
        id: 'sent',
        accountId: ACCOUNT_ID,
        name: '\\Sent',
        role: 'sent',
      })
      l1 = await db.Label.create({
        id: 'l1',
        name: 'l1',
        accountId: ACCOUNT_ID,
      })
      l2 = await db.Label.create({
        id: 'l2',
        name: 'l2',
        accountId: ACCOUNT_ID,
      })
      l3 = await db.Label.create({
        id: 'l3',
        name: 'l3',
        accountId: ACCOUNT_ID,
      })

      m1 = await db.Message.create({
        id: 'm1',
        folderImapUID: 1,
        accountId: ACCOUNT_ID,
      })
      await m1.setLabels(['l1', 'l2'])
      m1.labels = ['l1', 'l2']

      m2 = await db.Message.create({
        id: 'm2',
        folderImapUID: 2,
        accountId: ACCOUNT_ID,
      })
      await m2.setLabels(['l1', 'l2'])
      m2.labels = ['l1', 'l2']

      m3 = await db.Message.create({
        id: 'm3',
        folderImapUID: 3,
        accountId: ACCOUNT_ID,
      })
      await m3.setLabels(['l1'])
      m3.labels = ['l1']

      messages = [m1, m2, m3]
      const messagesByUID = {
        1: m1,
        2: m2,
        3: m3,
      }
      box = mockImapBox()
      box.removeLabels.mockImplementation(async (uids, labelsToRemove) => {
        if (!labelsToRemove || typeof labelsToRemove === 'string' || labelsToRemove.length === 0) {
          throw new Error('labelsToRemove must be a non-empty array')
        }
        for (const uid of uids) {
          const msg = messagesByUID[uid]
          msg.labels = msg.labels.filter(l => !labelsToRemove.includes(l))
        }
      })
      box.setLabels.mockImplementation(async (uids, labelsToSet) => {
        if (!labelsToSet || typeof labelsToSet === 'string' || labelsToSet.length === 0) {
          throw new Error('labelsToSet must be a non-empty array')
        }
        for (const uid of uids) {
          const msg = messagesByUID[uid]
          msg.labels = labelsToSet
        }
      })
    })

    it('removes all labels for each message if labelIds is empty', async () => {
      const labelIds = []
      await IMAPHelpers.setLabelsForMessages({db: db, box: box, messages: messages, labelIds})
      for (const msg of messages) {
        expect(msg.labels.length).toBe(0)
      }
    });

    it('does not remove the sent label from messages when removing all labels', async () => {
      await m3.addLabel(sentLabel)
      m3.labels.push(sentLabel.imapLabelIdentifier())

      const labelIds = []
      await IMAPHelpers.setLabelsForMessages({db: db, box: box, messages: messages, labelIds})

      expect(m1.labels.length).toBe(0)
      expect(m2.labels.length).toBe(0)
      expect(m3.labels.length).toBe(1)
      expect(m3.labels[0]).toEqual(sentLabel.imapLabelIdentifier())
    });

    it('does not try to remove labels if none present', async () => {
      await m1.setLabels([])
      m1.labels = []
      await m3.setLabels([sentLabel])
      m3.labels = [sentLabel.imapLabelIdentifier()]

      const labelIds = []
      await IMAPHelpers.setLabelsForMessages({
        labelIds,
        db: db,
        box: box,
        messages: [m1, m3],
      })

      expect(box.removeLabels).not.toHaveBeenCalled()
      expect(m1.labels.length).toBe(0)
      expect(m3.labels.length).toBe(1)
      expect(m3.labels[0]).toEqual(sentLabel.imapLabelIdentifier())
    });

    it('sets the provided labels', async () => {
      const labelIds = ['l1', 'l3']
      await IMAPHelpers.setLabelsForMessages({db: db, box: box, messages: messages, labelIds})
      for (const msg of messages) {
        expect(msg.labels).toEqual(labelIds)
      }
    });

    it(`keeps the sent label on messages even if it wasn't provided in the labels to set`, async () => {
      await m3.addLabel(sentLabel)
      m3.labels.push(sentLabel.imapLabelIdentifier())

      const labelIds = ['l1', 'l3']
      await IMAPHelpers.setLabelsForMessages({db: db, box: box, messages: messages, labelIds})

      expect(m1.labels).toEqual(labelIds)
      expect(m2.labels).toEqual(labelIds)
      expect(m3.labels).toEqual([...labelIds, sentLabel.imapLabelIdentifier()])
    });

    it(`does not attempt to add the sent label to messages even if the labels to set contain the sent label`, async () => {
      const labelIds = ['l1', 'l3', sentLabel.imapLabelIdentifier()]
      await IMAPHelpers.setLabelsForMessages({db: db, box: box, messages: messages, labelIds})
      for (const msg of messages) {
        expect(msg.labels).toEqual(labelIds.slice(0, 2))
      }
    })

    it(`does not attempt to set labels if no labels to set`, async () => {
      await m1.setLabels([])
      m1.labels = []
      const labelIds = [sentLabel.imapLabelIdentifier()]
      await IMAPHelpers.setLabelsForMessages({db: db, box: box, messages: [m1], labelIds})
      expect(box.removeLabels).not.toHaveBeenCalled()
      expect(m1.labels.length).toBe(0)
    })
  });
});
