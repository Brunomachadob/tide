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

  test('returns a non-empty string for a valid ISO date', () => {
    const iso = '2024-06-15T09:05:00Z'
    const result = formatDate(iso)
    assert.ok(typeof result === 'string' && result.length > 0)
  })

  test('returns a different string for a different date', () => {
    const a = formatDate('2024-01-01T00:00:00Z')
    const b = formatDate('2025-06-15T12:30:00Z')
    assert.notEqual(a, b)
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

  test('interval – whole days', () => {
    assert.equal(formatSchedule({ type: 'interval', intervalSeconds: 86400 }), 'every 1d')
    assert.equal(formatSchedule({ type: 'interval', intervalSeconds: 86400 * 7 }), 'every 7d')
    assert.equal(formatSchedule({ type: 'interval', intervalSeconds: 86400 * 30 }), 'every 30d')
  })

  test('interval – legacy .seconds field', () => {
    assert.equal(formatSchedule({ type: 'interval', seconds: 60 }), 'every 1m')
  })

  test('manual schedule type', () => {
    assert.equal(formatSchedule({ type: 'manual' }), 'manual')
  })

})
