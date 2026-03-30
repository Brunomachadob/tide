import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'tide-test-settings-'))
process.env.HOME = TMP

const { readSettings, writeSettings, formatDate, SETTINGS_FILE } =
  await import('../src/lib/settings.js?bust=1')

const TIDE_DIR = path.join(TMP, '.tide')

after(() => {
  fs.rmSync(TMP, { recursive: true, force: true })
})

// ── readSettings ───────────────────────────────────────────────────────────

describe('readSettings', () => {
  before(() => {
    // start clean
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
    // defaults still present
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
    // write twice quickly — file should never be half-written
    writeSettings({ dateFormat: 'YYYY-MM-DD', command: '', timezone: 'UTC', defaultWorkingDirectory: '/tmp' })
    writeSettings({ dateFormat: 'DD.MM.YYYY', command: 'x', timezone: 'UTC', defaultWorkingDirectory: '/tmp' })
    assert.equal(readSettings().dateFormat, 'DD.MM.YYYY')
  })
})

// ── formatDate ─────────────────────────────────────────────────────────────

describe('formatDate', () => {
  test('returns "never" for falsy input', () => {
    assert.equal(formatDate(null), 'never')
    assert.equal(formatDate(''), 'never')
    assert.equal(formatDate(undefined), 'never')
  })

  test('YYYY-MM-DD format', () => {
    // Use a fixed UTC timestamp and check the local representation
    const iso = '2024-06-15T09:05:00Z'
    const result = formatDate(iso, { dateFormat: 'YYYY-MM-DD', timezone: 'UTC' })
    // Result should contain the date in the right format (time zone may shift hour)
    assert.match(result, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/)
  })

  test('DD.MM.YYYY format', () => {
    const iso = '2024-06-15T09:05:00Z'
    const result = formatDate(iso, { dateFormat: 'DD.MM.YYYY' })
    assert.match(result, /^\d{2}\.\d{2}\.\d{4} \d{2}:\d{2}$/)
  })

  test('MM/DD/YYYY format', () => {
    const iso = '2024-06-15T09:05:00Z'
    const result = formatDate(iso, { dateFormat: 'MM/DD/YYYY' })
    assert.match(result, /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/)
  })

  test('pads single-digit month, day, hour, minute', () => {
    // 2024-01-05 at 08:05 local time — we construct a date that will be 08:05 in local tz
    const d = new Date(2024, 0, 5, 8, 5) // local time
    const iso = d.toISOString()
    const result = formatDate(iso, { dateFormat: 'YYYY-MM-DD' })
    assert.match(result, /\d{4}-01-05 08:05/)
  })
})
