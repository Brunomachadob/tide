import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'tide-test-lock-'))
process.env.HOME = TMP

const { acquireLock, releaseLock, isLocked } = await import('../src/lib/lock.js?bust=1')

function makeDir(id) {
  const d = path.join(TMP, id)
  fs.mkdirSync(d, { recursive: true })
  return d
}

function writeLock(tDir, content) {
  fs.writeFileSync(path.join(tDir, 'running.pid'), content, 'utf8')
}

function writeRunJson(tDir, runId, data) {
  const runDir = path.join(tDir, 'runs', runId)
  fs.mkdirSync(runDir, { recursive: true })
  fs.writeFileSync(path.join(runDir, 'run.json'), JSON.stringify(data), 'utf8')
}

// ─── acquireLock ──────────────────────────────────────────────────────────────

describe('acquireLock', () => {
  test('acquires lock when no lock file exists', () => {
    const tDir = makeDir('acquire-fresh')
    const result = acquireLock(tDir, 'run1')
    assert.equal(result.acquired, true)
    const content = fs.readFileSync(path.join(tDir, 'running.pid'), 'utf8')
    assert.equal(content, `run1:${process.pid}`)
  })

  test('clears stale lock (dead PID) and acquires', () => {
    const tDir = makeDir('acquire-stale')
    writeLock(tDir, 'oldrun:99999999')
    const result = acquireLock(tDir, 'run2')
    assert.equal(result.acquired, true)
    const content = fs.readFileSync(path.join(tDir, 'running.pid'), 'utf8')
    assert.equal(content, `run2:${process.pid}`)
  })

  test('returns acquired:false when existing process is alive', () => {
    const tDir = makeDir('acquire-alive')
    writeLock(tDir, `oldrun:${process.pid}`)
    const result = acquireLock(tDir, 'run3')
    assert.equal(result.acquired, false)
    assert.equal(result.existingPid, String(process.pid))
    // Lock file is unchanged
    const content = fs.readFileSync(path.join(tDir, 'running.pid'), 'utf8')
    assert.equal(content, `oldrun:${process.pid}`)
  })

  test('clears lock with empty/malformed content and acquires', () => {
    const tDir = makeDir('acquire-malformed')
    writeLock(tDir, 'notvalid')
    const result = acquireLock(tDir, 'run4')
    assert.equal(result.acquired, true)
  })
})

// ─── releaseLock ──────────────────────────────────────────────────────────────

describe('releaseLock', () => {
  test('deletes the lock file', () => {
    const tDir = makeDir('release-exists')
    writeLock(tDir, `run1:${process.pid}`)
    releaseLock(tDir)
    assert.equal(fs.existsSync(path.join(tDir, 'running.pid')), false)
  })

  test('is a no-op when lock file is absent', () => {
    const tDir = makeDir('release-absent')
    assert.doesNotThrow(() => releaseLock(tDir))
  })
})

// ─── isLocked ─────────────────────────────────────────────────────────────────

describe('isLocked', () => {
  test('returns false when lock file is absent', () => {
    assert.equal(isLocked(makeDir('locked-absent')), false)
  })

  test('returns false for bare PID (legacy format, no colon)', () => {
    const tDir = makeDir('locked-legacy')
    writeLock(tDir, String(process.pid))
    assert.equal(isLocked(tDir), false)
  })

  test('returns false when PID is dead', () => {
    const tDir = makeDir('locked-dead')
    writeLock(tDir, 'abc:99999999')
    assert.equal(isLocked(tDir), false)
  })

  test('returns false when PID is alive but no run.json exists', () => {
    const tDir = makeDir('locked-no-run')
    writeLock(tDir, `abc:${process.pid}`)
    assert.equal(isLocked(tDir), false)
  })

  test('returns false when PID is alive but run.json has completedAt', () => {
    const tDir = makeDir('locked-completed')
    writeLock(tDir, `abc:${process.pid}`)
    writeRunJson(tDir, 'abc', { runId: 'abc', startedAt: '2026-01-01T00:00:00Z', completedAt: '2026-01-01T00:01:00Z', exitCode: 0 })
    assert.equal(isLocked(tDir), false)
  })

  test('returns true when PID is alive and run.json has no completedAt', () => {
    const tDir = makeDir('locked-running')
    writeLock(tDir, `abc:${process.pid}`)
    writeRunJson(tDir, 'abc', { runId: 'abc', startedAt: '2026-01-01T00:00:00Z' })
    assert.equal(isLocked(tDir), true)
  })
})
