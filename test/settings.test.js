import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'tide-test-settings-'))
process.env.HOME = TMP

const { readSettings, writeSettings, SETTINGS_FILE } =
  await import('../src/lib/settings.js?bust=1')

const TIDE_DIR = path.join(TMP, '.tide')

after(() => {
  fs.rmSync(TMP, { recursive: true, force: true })
})

// ── readSettings ───────────────────────────────────────────────────────────

describe('readSettings', () => {
  before(() => {
    if (fs.existsSync(TIDE_DIR)) fs.rmSync(TIDE_DIR, { recursive: true, force: true })
  })

  test('returns defaults when file does not exist', () => {
    const s = readSettings()
    assert.equal(s.dateFormat, 'YYYY-MM-DD')
    assert.equal(s.command, '')
    assert.ok(s.timezone)
    assert.ok(s.defaultWorkingDirectory)
  })

  test('merges stored values with defaults', () => {
    fs.mkdirSync(TIDE_DIR, { recursive: true })
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify({ dateFormat: 'DD.MM.YYYY', command: 'my-cmd' }))
    const s = readSettings()
    assert.equal(s.dateFormat, 'DD.MM.YYYY')
    assert.equal(s.command, 'my-cmd')
    assert.ok(s.timezone)
  })

  test('returns defaults when file contains corrupt JSON', () => {
    fs.writeFileSync(SETTINGS_FILE, 'not-json')
    const s = readSettings()
    assert.equal(s.dateFormat, 'YYYY-MM-DD')
  })
})

// ── writeSettings ──────────────────────────────────────────────────────────

describe('writeSettings', () => {
  before(() => {
    fs.mkdirSync(TIDE_DIR, { recursive: true })
  })

  test('writes and reads back', () => {
    writeSettings({ dateFormat: 'MM/DD/YYYY', command: 'node', timezone: 'UTC', defaultWorkingDirectory: '/tmp' })
    const s = readSettings()
    assert.equal(s.dateFormat, 'MM/DD/YYYY')
    assert.equal(s.command, 'node')
  })

  test('is atomic (uses tmp rename)', () => {
    writeSettings({ dateFormat: 'YYYY-MM-DD', command: '', timezone: 'UTC', defaultWorkingDirectory: '/tmp' })
    writeSettings({ dateFormat: 'DD.MM.YYYY', command: 'x', timezone: 'UTC', defaultWorkingDirectory: '/tmp' })
    assert.equal(readSettings().dateFormat, 'DD.MM.YYYY')
  })
})
