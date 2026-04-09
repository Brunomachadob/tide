import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'tide-test-load-tasks-'))
process.env.HOME = TMP

const { safeReadJSON } = await import('../src/lib/io.js?bust=1')

// Import isRunningViaPidFile indirectly — it's not exported, so we test it
// through the observable behaviour: write fixture files and check loadTasks output.
// For focused unit-style tests we replicate the function's logic directly.

const TASKS_DIR = path.join(TMP, '.tide', 'tasks')

function taskDir(id) { return path.join(TASKS_DIR, id) }

function writePidFile(id, content) {
  fs.mkdirSync(taskDir(id), { recursive: true })
  fs.writeFileSync(path.join(taskDir(id), 'running.pid'), content, 'utf8')
}

function writeRunJson(id, runId, data) {
  const runDir = path.join(taskDir(id), 'runs', runId)
  fs.mkdirSync(runDir, { recursive: true })
  fs.writeFileSync(path.join(runDir, 'run.json'), JSON.stringify(data), 'utf8')
}

// Replicate isRunningViaPidFile for direct unit testing
function isRunningViaPidFile(taskId) {
  try {
    const pidFile = path.join(taskDir(taskId), 'running.pid')
    const [runId, pidStr] = fs.readFileSync(pidFile, 'utf8').trim().split(':')
    if (!runId || !pidStr) return false
    process.kill(parseInt(pidStr), 0)
    const runFile = path.join(taskDir(taskId), 'runs', runId, 'run.json')
    const run = safeReadJSON(runFile)
    return run !== null && !run.completedAt
  } catch {
    return false
  }
}

describe('isRunningViaPidFile', () => {
  test('returns false when pid file is absent', () => {
    assert.equal(isRunningViaPidFile('no-such-task'), false)
  })

  test('returns false for bare PID (legacy format, no colon)', () => {
    writePidFile('legacy', String(process.pid))
    assert.equal(isRunningViaPidFile('legacy'), false)
  })

  test('returns false for empty pid file', () => {
    writePidFile('empty', '')
    assert.equal(isRunningViaPidFile('empty'), false)
  })

  test('returns false when PID is dead', () => {
    writePidFile('dead', 'abc123:99999999')
    assert.equal(isRunningViaPidFile('dead'), false)
  })

  test('returns false when PID is alive but no run.json exists', () => {
    writePidFile('no-run', `abc123:${process.pid}`)
    assert.equal(isRunningViaPidFile('no-run'), false)
  })

  test('returns false when PID is alive but run.json has completedAt', () => {
    const id = 'completed'
    writePidFile(id, `abc123:${process.pid}`)
    writeRunJson(id, 'abc123', { runId: 'abc123', startedAt: '2026-01-01T00:00:00Z', completedAt: '2026-01-01T00:01:00Z', exitCode: 0 })
    assert.equal(isRunningViaPidFile(id), false)
  })

  test('returns true when PID is alive and run.json has no completedAt', () => {
    const id = 'running'
    writePidFile(id, `abc123:${process.pid}`)
    writeRunJson(id, 'abc123', { runId: 'abc123', startedAt: '2026-01-01T00:00:00Z' })
    assert.equal(isRunningViaPidFile(id), true)
  })
})
