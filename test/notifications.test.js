import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'tide-test-notif-'))
process.env.HOME = TMP

const { getNotifications, clearNotifications } = await import('../src/lib/notifications.js?bust=1')

const TIDE_DIR = path.join(TMP, '.tide')
const NOTIF_FILE = path.join(TIDE_DIR, 'pending-notifications.json')

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
    const data = [{ taskId: 'abc', message: 'done' }]
    fs.writeFileSync(NOTIF_FILE, JSON.stringify(data))
    assert.deepEqual(getNotifications(), data)
  })
})

describe('clearNotifications', () => {
  test('writes an empty array', () => {
    fs.writeFileSync(NOTIF_FILE, JSON.stringify([{ taskId: 'x' }]))
    clearNotifications()
    assert.deepEqual(getNotifications(), [])
  })

  test('is idempotent', () => {
    clearNotifications()
    clearNotifications()
    assert.deepEqual(getNotifications(), [])
  })
})
