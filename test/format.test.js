import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { formatDate, formatRelativeTime, formatSchedule } from '../src/lib/format.js'

// ── formatDate ─────────────────────────────────────────────────────────────

describe('formatDate', () => {
  test('returns "never" for falsy input', () => {
    assert.equal(formatDate(null), 'never')
    assert.equal(formatDate(''), 'never')
    assert.equal(formatDate(undefined), 'never')
  })

  test('YYYY-MM-DD format', () => {
    const iso = '2024-06-15T09:05:00Z'
    assert.match(formatDate(iso, { dateFormat: 'YYYY-MM-DD' }), /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/)
  })

  test('DD.MM.YYYY format', () => {
    const iso = '2024-06-15T09:05:00Z'
    assert.match(formatDate(iso, { dateFormat: 'DD.MM.YYYY' }), /^\d{2}\.\d{2}\.\d{4} \d{2}:\d{2}$/)
  })

  test('MM/DD/YYYY format', () => {
    const iso = '2024-06-15T09:05:00Z'
    assert.match(formatDate(iso, { dateFormat: 'MM/DD/YYYY' }), /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/)
  })

  test('pads single-digit month, day, hour, minute', () => {
    const d = new Date(2024, 0, 5, 8, 5) // local time
    assert.match(formatDate(d.toISOString(), { dateFormat: 'YYYY-MM-DD' }), /\d{4}-01-05 08:05/)
  })
})

// ── formatRelativeTime ─────────────────────────────────────────────────────

describe('formatRelativeTime', () => {
  const ago = secs => new Date(Date.now() - secs * 1000).toISOString()

  test('returns "never" for falsy input', () => {
    assert.equal(formatRelativeTime(null), 'never')
    assert.equal(formatRelativeTime(''), 'never')
    assert.equal(formatRelativeTime(undefined), 'never')
  })

  test('seconds ago', () => {
    assert.equal(formatRelativeTime(ago(30)), '30s ago')
  })

  test('minutes ago', () => {
    assert.equal(formatRelativeTime(ago(90)), '1m ago')
    assert.equal(formatRelativeTime(ago(150)), '2m ago')
  })

  test('hours ago', () => {
    assert.equal(formatRelativeTime(ago(3600)), '1h ago')
    assert.equal(formatRelativeTime(ago(7200)), '2h ago')
  })

  test('days ago', () => {
    assert.equal(formatRelativeTime(ago(86400)), '1d ago')
    assert.equal(formatRelativeTime(ago(86400 * 3)), '3d ago')
  })

  test('months ago', () => {
    assert.equal(formatRelativeTime(ago(86400 * 31)), '1mo ago')
  })

  test('years ago', () => {
    assert.equal(formatRelativeTime(ago(86400 * 366)), '1y ago')
  })
})

// ── formatSchedule ─────────────────────────────────────────────────────────

describe('formatSchedule', () => {
  test('returns "unknown" for falsy input', () => {
    assert.equal(formatSchedule(null), 'unknown')
    assert.equal(formatSchedule(undefined), 'unknown')
  })

  test('interval – seconds < 60', () => {
    assert.equal(formatSchedule({ type: 'interval', intervalSeconds: 30 }), 'every 30s')
  })

  test('interval – seconds < 3600', () => {
    assert.equal(formatSchedule({ type: 'interval', intervalSeconds: 90 }), 'every 1m')
    assert.equal(formatSchedule({ type: 'interval', intervalSeconds: 150 }), 'every 2m')
  })

  test('interval – whole hours', () => {
    assert.equal(formatSchedule({ type: 'interval', intervalSeconds: 7200 }), 'every 2h')
  })

  test('interval – hours and minutes', () => {
    assert.equal(formatSchedule({ type: 'interval', intervalSeconds: 5400 }), 'every 1h 30m')
  })

  test('interval – legacy .seconds field', () => {
    assert.equal(formatSchedule({ type: 'interval', seconds: 60 }), 'every 1m')
  })

  test('manual schedule type', () => {
    assert.equal(formatSchedule({ type: 'manual' }), 'manual')
  })

})
