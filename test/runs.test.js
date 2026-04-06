import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'tide-test-runs-'))
process.env.HOME = TMP

const { getRuns, getLatestRun, getLatestCompletedRun, finalizeAbandonedRun } = await import('../src/lib/runs.js?bust=1')

const TASKS_DIR = path.join(TMP, '.tide', 'tasks')

function runsDir(taskId) {
  return path.join(TASKS_DIR, taskId, 'runs')
}

function writeRun(taskId, runId, data) {
  const dir = path.join(runsDir(taskId), runId)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'run.json'), JSON.stringify(data))
}

after(() => {
  fs.rmSync(TMP, { recursive: true, force: true })
})

describe('getRuns', () => {
  test('returns [] for unknown task', () => {
    assert.deepEqual(getRuns('no-such-task'), [])
  })

  test('returns [] when runs dir is empty', () => {
    fs.mkdirSync(runsDir('empty-task'), { recursive: true })
    assert.deepEqual(getRuns('empty-task'), [])
  })

  test('returns runs most-recent-first by startedAt', () => {
    const taskId = 'ordered-task'
    writeRun(taskId, 'run1', { runId: 'run1', startedAt: '2024-01-01T08:00:00Z', completedAt: '2024-01-01T08:00:05Z', exitCode: 0 })
    writeRun(taskId, 'run2', { runId: 'run2', startedAt: '2024-01-03T08:00:00Z', completedAt: '2024-01-03T08:00:05Z', exitCode: 0 })
    writeRun(taskId, 'run3', { runId: 'run3', startedAt: '2024-01-02T08:00:00Z', completedAt: '2024-01-02T08:00:05Z', exitCode: 1 })

    const runs = getRuns(taskId)
    assert.equal(runs.length, 3)
    assert.equal(runs[0].startedAt, '2024-01-03T08:00:00Z')
    assert.equal(runs[1].startedAt, '2024-01-02T08:00:00Z')
    assert.equal(runs[2].startedAt, '2024-01-01T08:00:00Z')
  })

  test('respects the count limit', () => {
    const taskId = 'limit-task'
    writeRun(taskId, 'r1', { runId: 'r1', startedAt: '2024-01-01T08:00:00Z' })
    writeRun(taskId, 'r2', { runId: 'r2', startedAt: '2024-01-02T08:00:00Z' })
    writeRun(taskId, 'r3', { runId: 'r3', startedAt: '2024-01-03T08:00:00Z' })

    const runs = getRuns(taskId, 2)
    assert.equal(runs.length, 2)
    assert.equal(runs[0].startedAt, '2024-01-03T08:00:00Z')
  })

  test('includes in-progress runs (no completedAt)', () => {
    const taskId = 'inprogress-task'
    const recentStart = new Date().toISOString()
    writeRun(taskId, 'done', { runId: 'done', startedAt: '2024-01-01T08:00:00Z', completedAt: '2024-01-01T08:00:05Z', exitCode: 0 })
    writeRun(taskId, 'running', { runId: 'running', startedAt: recentStart })

    const runs = getRuns(taskId)
    assert.equal(runs.length, 2)
    assert.equal(runs[0].runId, 'running')
    assert.equal(runs[0].completedAt, undefined)
  })

  test('skips subdirectories without a run.json', () => {
    const taskId = 'skip-task'
    fs.mkdirSync(path.join(runsDir(taskId), 'empty-dir'), { recursive: true })
    writeRun(taskId, 'valid', { runId: 'valid', startedAt: '2024-01-01T08:00:00Z' })

    const runs = getRuns(taskId)
    assert.equal(runs.length, 1)
    assert.equal(runs[0].runId, 'valid')
  })
})

describe('getLatestRun', () => {
  before(() => {
    writeRun('latest-task', 'old', { runId: 'old', startedAt: '2024-01-01T08:00:00Z', exitCode: 0 })
    writeRun('latest-task', 'new', { runId: 'new', startedAt: '2024-01-02T08:00:00Z', exitCode: 1 })
  })

  test('returns the single most recent run', () => {
    const latest = getLatestRun('latest-task')
    assert.equal(latest?.runId, 'new')
  })

  test('returns null when task has no runs', () => {
    assert.equal(getLatestRun('no-such-task'), null)
  })
})

describe('getLatestCompletedRun', () => {
  before(() => {
    writeRun('completed-task', 'done1', { runId: 'done1', startedAt: '2024-01-01T08:00:00Z', completedAt: '2024-01-01T08:00:05Z', exitCode: 0 })
    writeRun('completed-task', 'done2', { runId: 'done2', startedAt: '2024-01-02T08:00:00Z', completedAt: '2024-01-02T08:00:05Z', exitCode: 1 })
    writeRun('completed-task', 'running', { runId: 'running', startedAt: new Date().toISOString() })
  })

  test('skips in-progress run and returns the most recent completed run', () => {
    const latest = getLatestCompletedRun('completed-task')
    assert.equal(latest?.runId, 'done2')
  })

  test('returns null when task has no completed runs', () => {
    writeRun('only-running-task', 'r1', { runId: 'r1', startedAt: new Date().toISOString() })
    assert.equal(getLatestCompletedRun('only-running-task'), null)
  })

  test('returns null when task has no runs', () => {
    assert.equal(getLatestCompletedRun('no-such-task'), null)
  })
})

describe('finalizeAbandonedRun', () => {
  test('returns run unchanged when completedAt is already set', () => {
    const run = { runId: 'r1', startedAt: '2024-01-01T08:00:00Z', completedAt: '2024-01-01T08:00:05Z', exitCode: 0 }
    assert.deepEqual(finalizeAbandonedRun('any-task', run, '/tmp'), run)
  })

  test('returns run unchanged when no pid file exists and run is recent', () => {
    const run = { runId: 'r1', startedAt: new Date().toISOString() }
    const result = finalizeAbandonedRun('no-pid-task', run, '/tmp')
    assert.equal(result.completedAt, undefined)
    assert.equal(result.abandoned, undefined)
  })

  test('marks run as abandoned when pid file exists but process is dead', () => {
    const taskId = 'stale-pid-task'
    const taskDir = path.join(TASKS_DIR, taskId)
    fs.mkdirSync(taskDir, { recursive: true })
    // PID 1 is always alive on macOS (launchd), so use a clearly dead PID instead
    // Write a PID that cannot possibly be alive (max pid + 1 wraps, use 99999999)
    fs.writeFileSync(path.join(taskDir, 'running.pid'), '99999999')

    const runDir = path.join(TMP, 'stale-run')
    fs.mkdirSync(runDir, { recursive: true })
    const run = { runId: 'r1', startedAt: '2024-01-01T08:00:00Z' }
    fs.writeFileSync(path.join(runDir, 'run.json'), JSON.stringify(run))

    const result = finalizeAbandonedRun(taskId, run, runDir)
    assert.equal(result.abandoned, true)
    assert.equal(result.exitCode, -1)
    assert.ok(result.completedAt)

    // Should have written finalized run.json
    const saved = JSON.parse(fs.readFileSync(path.join(runDir, 'run.json'), 'utf8'))
    assert.equal(saved.abandoned, true)
  })
})
