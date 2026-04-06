import { test, describe, before, after, beforeEach } from 'node:test'
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
const NOTIF_DIR = path.join(TIDE_DIR, 'notifications')

function writeNotif(runId, data) {
  fs.mkdirSync(NOTIF_DIR, { recursive: true })
  fs.writeFileSync(path.join(NOTIF_DIR, `${runId}.json`), JSON.stringify(data))
}

function clearNotifDir() {
  try {
    for (const f of fs.readdirSync(NOTIF_DIR)) {
      fs.unlinkSync(path.join(NOTIF_DIR, f))
    }
  } catch { /* ok if missing */ }
}

before(() => {
  fs.mkdirSync(TIDE_DIR, { recursive: true })
})

after(() => {
  fs.rmSync(TMP, { recursive: true, force: true })
})

beforeEach(() => {
  clearNotifDir()
})

describe('getNotifications', () => {
  test('returns [] when directory does not exist', () => {
    try { fs.rmSync(NOTIF_DIR, { recursive: true }) } catch { /* ok */ }
    assert.deepEqual(getNotifications(), [])
  })

  test('returns [] when directory is empty', () => {
    fs.mkdirSync(NOTIF_DIR, { recursive: true })
    assert.deepEqual(getNotifications(), [])
  })

  test('returns [] for corrupt JSON file', () => {
    fs.mkdirSync(NOTIF_DIR, { recursive: true })
    fs.writeFileSync(path.join(NOTIF_DIR, 'run-bad.json'), 'bad-json')
    assert.deepEqual(getNotifications(), [])
  })

  test('returns parsed notifications sorted by completedAt', () => {
    writeNotif('run-b', { runId: 'run-b', taskId: 'abc', completedAt: '2024-01-02T00:00:00Z', read: false })
    writeNotif('run-a', { runId: 'run-a', taskId: 'abc', completedAt: '2024-01-01T00:00:00Z', read: false })
    const result = getNotifications()
    assert.equal(result.length, 2)
    assert.equal(result[0].runId, 'run-a')
    assert.equal(result[1].runId, 'run-b')
  })
})

describe('dismissNotification', () => {
  test('removes only the matching taskId + completedAt', () => {
    writeNotif('run-a', { runId: 'run-a', taskId: 'a', completedAt: '2024-01-01T00:00:00Z', read: false })
    writeNotif('run-b', { runId: 'run-b', taskId: 'b', completedAt: '2024-01-01T00:01:00Z', read: false })
    writeNotif('run-c', { runId: 'run-c', taskId: 'c', completedAt: '2024-01-01T00:02:00Z', read: false })
    dismissNotification('b', '2024-01-01T00:01:00Z')
    const result = getNotifications()
    assert.equal(result.length, 2)
    assert.ok(result.every(n => n.taskId !== 'b'))
  })

  test('does not remove other runs of the same task', () => {
    writeNotif('run-a1', { runId: 'run-a1', taskId: 'a', completedAt: '2024-01-01T00:00:00Z', read: false })
    writeNotif('run-a2', { runId: 'run-a2', taskId: 'a', completedAt: '2024-01-01T00:01:00Z', read: false })
    dismissNotification('a', '2024-01-01T00:00:00Z')
    const result = getNotifications()
    assert.equal(result.length, 1)
    assert.equal(result[0].runId, 'run-a2')
  })

  test('is a no-op for an unknown taskId', () => {
    writeNotif('run-a', { runId: 'run-a', taskId: 'a', completedAt: '2024-01-01T00:00:00Z', read: false })
    dismissNotification('z', '2024-01-01T00:00:00Z')
    assert.equal(getNotifications().length, 1)
  })
})

describe('clearNotifications', () => {
  test('removes all notifications', () => {
    writeNotif('run-x', { runId: 'run-x', taskId: 'x', completedAt: '2024-01-01T00:00:00Z', read: false })
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
    writeNotif('run-a', { runId: 'run-a', taskId: 'a', completedAt: '2024-01-01T00:00:00Z', read: false })
    writeNotif('run-b', { runId: 'run-b', taskId: 'b', completedAt: '2024-01-01T00:01:00Z', read: false })
    markNotificationRead('a', '2024-01-01T00:00:00Z')
    const result = getNotifications()
    assert.equal(result.find(n => n.runId === 'run-a').read, true)
    assert.equal(result.find(n => n.runId === 'run-b').read, false)
  })

  test('is a no-op for unknown taskId', () => {
    writeNotif('run-a', { runId: 'run-a', taskId: 'a', completedAt: '2024-01-01T00:00:00Z', read: false })
    markNotificationRead('z', '2024-01-01T00:00:00Z')
    assert.equal(getNotifications()[0].read, false)
  })
})

describe('markAllNotificationsRead', () => {
  test('marks all notifications as read', () => {
    writeNotif('run-a', { runId: 'run-a', taskId: 'a', completedAt: '2024-01-01T00:00:00Z', read: false })
    writeNotif('run-b', { runId: 'run-b', taskId: 'b', completedAt: '2024-01-01T00:01:00Z', read: false })
    markAllNotificationsRead()
    const result = getNotifications()
    assert.ok(result.every(n => n.read === true))
  })
})

describe('clearReadNotifications', () => {
  test('removes only read notifications', () => {
    writeNotif('run-a', { runId: 'run-a', taskId: 'a', completedAt: '2024-01-01T00:00:00Z', read: true })
    writeNotif('run-b', { runId: 'run-b', taskId: 'b', completedAt: '2024-01-01T00:01:00Z', read: false })
    writeNotif('run-c', { runId: 'run-c', taskId: 'c', completedAt: '2024-01-01T00:02:00Z', read: true })
    clearReadNotifications()
    const result = getNotifications()
    assert.equal(result.length, 1)
    assert.equal(result[0].taskId, 'b')
  })

  test('is a no-op when no notifications are read', () => {
    writeNotif('run-a', { runId: 'run-a', taskId: 'a', completedAt: '2024-01-01T00:00:00Z', read: false })
    clearReadNotifications()
    assert.equal(getNotifications().length, 1)
  })
})
