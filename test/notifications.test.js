import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'tide-test-notif-'))
process.env.HOME = TMP

const {
  getNotifications,
  clearNotifications,
  clearReadNotifications,
  dismissNotification,
  markNotificationRead,
  markAllNotificationsRead,
} = await import('../src/lib/notifications.js?bust=1')

const TIDE_DIR = path.join(TMP, '.tide')
const NOTIF_FILE = path.join(TIDE_DIR, 'notifications.json')

before(() => {
  fs.mkdirSync(TIDE_DIR, { recursive: true })
})

after(() => {
  fs.rmSync(TMP, { recursive: true, force: true })
})

describe('getNotifications', () => {
  test('returns [] when file does not exist', () => {
    if (fs.existsSync(NOTIF_FILE)) fs.unlinkSync(NOTIF_FILE)
    assert.deepEqual(getNotifications(), [])
  })

  test('returns [] for corrupt JSON', () => {
    fs.writeFileSync(NOTIF_FILE, 'bad-json')
    assert.deepEqual(getNotifications(), [])
  })

  test('returns parsed array when file is valid', () => {
    const data = [{ taskId: 'abc', message: 'done', read: false }]
    fs.writeFileSync(NOTIF_FILE, JSON.stringify(data))
    assert.deepEqual(getNotifications(), data)
  })
})

describe('dismissNotification', () => {
  test('removes only the matching taskId + completedAt', () => {
    const data = [
      { taskId: 'a', completedAt: '2024-01-01T00:00:00Z', read: false },
      { taskId: 'b', completedAt: '2024-01-01T00:01:00Z', read: false },
      { taskId: 'c', completedAt: '2024-01-01T00:02:00Z', read: false },
    ]
    fs.writeFileSync(NOTIF_FILE, JSON.stringify(data))
    dismissNotification('b', '2024-01-01T00:01:00Z')
    assert.deepEqual(getNotifications(), [data[0], data[2]])
  })

  test('does not remove other runs of the same task', () => {
    const data = [
      { taskId: 'a', completedAt: '2024-01-01T00:00:00Z', read: false },
      { taskId: 'a', completedAt: '2024-01-01T00:01:00Z', read: false },
    ]
    fs.writeFileSync(NOTIF_FILE, JSON.stringify(data))
    dismissNotification('a', '2024-01-01T00:00:00Z')
    assert.deepEqual(getNotifications(), [data[1]])
  })

  test('is a no-op for an unknown taskId', () => {
    const data = [{ taskId: 'a', completedAt: '2024-01-01T00:00:00Z', read: false }]
    fs.writeFileSync(NOTIF_FILE, JSON.stringify(data))
    dismissNotification('z', '2024-01-01T00:00:00Z')
    assert.deepEqual(getNotifications(), data)
  })
})

describe('clearNotifications', () => {
  test('writes an empty array', () => {
    fs.writeFileSync(NOTIF_FILE, JSON.stringify([{ taskId: 'x', read: false }]))
    clearNotifications()
    assert.deepEqual(getNotifications(), [])
  })

  test('is idempotent', () => {
    clearNotifications()
    clearNotifications()
    assert.deepEqual(getNotifications(), [])
  })
})

describe('markNotificationRead', () => {
  test('marks only the matching notification as read', () => {
    const data = [
      { taskId: 'a', completedAt: '2024-01-01T00:00:00Z', read: false },
      { taskId: 'b', completedAt: '2024-01-01T00:01:00Z', read: false },
    ]
    fs.writeFileSync(NOTIF_FILE, JSON.stringify(data))
    markNotificationRead('a', '2024-01-01T00:00:00Z')
    const result = getNotifications()
    assert.equal(result[0].read, true)
    assert.equal(result[1].read, false)
  })

  test('is a no-op for unknown taskId', () => {
    const data = [{ taskId: 'a', completedAt: '2024-01-01T00:00:00Z', read: false }]
    fs.writeFileSync(NOTIF_FILE, JSON.stringify(data))
    markNotificationRead('z', '2024-01-01T00:00:00Z')
    assert.equal(getNotifications()[0].read, false)
  })
})

describe('markAllNotificationsRead', () => {
  test('marks all notifications as read', () => {
    const data = [
      { taskId: 'a', completedAt: '2024-01-01T00:00:00Z', read: false },
      { taskId: 'b', completedAt: '2024-01-01T00:01:00Z', read: false },
    ]
    fs.writeFileSync(NOTIF_FILE, JSON.stringify(data))
    markAllNotificationsRead()
    const result = getNotifications()
    assert.ok(result.every(n => n.read === true))
  })
})

describe('clearReadNotifications', () => {
  test('removes only read notifications', () => {
    const data = [
      { taskId: 'a', completedAt: '2024-01-01T00:00:00Z', read: true },
      { taskId: 'b', completedAt: '2024-01-01T00:01:00Z', read: false },
      { taskId: 'c', completedAt: '2024-01-01T00:02:00Z', read: true },
    ]
    fs.writeFileSync(NOTIF_FILE, JSON.stringify(data))
    clearReadNotifications()
    const result = getNotifications()
    assert.equal(result.length, 1)
    assert.equal(result[0].taskId, 'b')
  })

  test('is a no-op when no notifications are read', () => {
    const data = [{ taskId: 'a', completedAt: '2024-01-01T00:00:00Z', read: false }]
    fs.writeFileSync(NOTIF_FILE, JSON.stringify(data))
    clearReadNotifications()
    assert.deepEqual(getNotifications(), data)
  })
})
