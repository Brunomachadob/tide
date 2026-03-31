import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const SCRIPT = path.resolve('scripts/task-postprocess.js')

// ── helpers ────────────────────────────────────────────────────────────────

let TMP

function setup() {
  TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'tide-test-postprocess-'))
  const taskId = 'test-task-01'
  const taskDir = path.join(TMP, '.tide', 'tasks', taskId)
  fs.mkdirSync(path.join(taskDir, 'results'), { recursive: true })
  fs.mkdirSync(path.join(taskDir, 'logs'), { recursive: true })
  return taskId
}

function writeTaskFile(taskId, overrides = {}) {
  const taskDir = path.join(TMP, '.tide', 'tasks', taskId)
  const task = {
    id: taskId,
    name: 'Test Task',
    command: 'echo',
    extraArgs: [],
    maxRetries: 0,
    workingDirectory: TMP,
    resultRetentionDays: 30,
    ...overrides,
  }
  const taskFile = path.join(taskDir, 'task.json')
  fs.writeFileSync(taskFile, JSON.stringify(task, null, 2))
  return taskFile
}

function runScript(...args) {
  return spawnSync('node', [SCRIPT, ...args], {
    encoding: 'utf8',
    env: { ...process.env, HOME: TMP },
  })
}

function notifFile() {
  return path.join(TMP, '.tide', 'notifications.json')
}

// ── tests ──────────────────────────────────────────────────────────────────

describe('task-postprocess', () => {
  let taskId
  let taskFile
  let outputLog
  let stderrLog

  before(() => {
    taskId = setup()
    taskFile = writeTaskFile(taskId)
    const logsDir = path.join(TMP, '.tide', 'tasks', taskId, 'logs')
    outputLog = path.join(logsDir, 'output.log')
    stderrLog = path.join(logsDir, 'stderr.log')
    fs.writeFileSync(outputLog, '')
    fs.writeFileSync(stderrLog, '')
  })

  after(() => { fs.rmSync(TMP, { recursive: true, force: true }) })

  function runPost(overrides = {}) {
    const defaults = {
      exitCode: '0',
      startedAt: '2024-01-01T09:00:00Z',
      completedAt: '2024-01-01T09:00:05Z',
      attempts: '1',
    }
    const o = { ...defaults, ...overrides }
    return runScript(taskFile, o.exitCode, o.startedAt, o.completedAt, o.attempts, outputLog, stderrLog)
  }

  test('writes a result JSON file', () => {
    fs.writeFileSync(outputLog, 'Task output here\n')
    const { status } = runPost({ startedAt: '2024-02-01T10:00:00Z', completedAt: '2024-02-01T10:00:05Z' })
    assert.equal(status, 0)
    const resultsDir = path.join(TMP, '.tide', 'tasks', taskId, 'results')
    const files = fs.readdirSync(resultsDir).filter(f => f.endsWith('.json'))
    assert.equal(files.length, 1)
    const result = JSON.parse(fs.readFileSync(path.join(resultsDir, files[0]), 'utf8'))
    assert.equal(result.taskId, taskId)
    assert.equal(result.exitCode, 0)
    assert.equal(result.attempts, 1)
  })

  test('appends to pending-notifications.json', () => {
    runPost({ startedAt: '2024-03-01T10:00:00Z', completedAt: '2024-03-01T10:00:05Z', exitCode: '1' })
    const entries = JSON.parse(fs.readFileSync(notifFile(), 'utf8'))
    assert.ok(entries.length >= 1)
    const entry = entries[entries.length - 1]
    assert.equal(entry.taskId, taskId)
    assert.equal(entry.exitCode, 1)
    assert.ok(entry.completedAt)
    assert.equal(entry.read, false)
  })

  test('appends to existing notifications rather than replacing', () => {
    const existing = [{ taskId: 'other', exitCode: 0 }]
    fs.writeFileSync(notifFile(), JSON.stringify(existing))
    runPost({ startedAt: '2024-04-01T10:00:00Z', completedAt: '2024-04-01T10:00:05Z' })
    const entries = JSON.parse(fs.readFileSync(notifFile(), 'utf8'))
    assert.ok(entries.length >= 2)
    assert.equal(entries[0].taskId, 'other')
  })

  test('truncates output summary to 300 chars in notification', () => {
    fs.writeFileSync(outputLog, 'x'.repeat(500))
    runPost({
      startedAt: '2024-05-01T10:00:00Z',
      completedAt: '2024-05-01T10:00:05Z',
    })
    const entries = JSON.parse(fs.readFileSync(notifFile(), 'utf8'))
    const last = entries[entries.length - 1]
    assert.equal(last.summary.length, 300)
  })

  test('rotates output log when it exceeds 5MB', () => {
    const bigLog = path.join(TMP, '.tide', 'tasks', taskId, 'logs', 'big.log')
    // write slightly over 5MB
    fs.writeFileSync(bigLog, Buffer.alloc(5 * 1024 * 1024 + 100, 'a'))
    runScript(taskFile, '0',
      '2024-06-01T10:00:00Z', '2024-06-01T10:00:05Z',
      '0', bigLog, stderrLog)
    const content = fs.readFileSync(bigLog, 'utf8')
    assert.ok(content.startsWith('[... rotated ...]'))
    assert.ok(content.length < 5 * 1024 * 1024)
  })

  test('does not rotate log under 5MB', () => {
    const smallLog = path.join(TMP, '.tide', 'tasks', taskId, 'logs', 'small.log')
    const original = 'line1\nline2\n'
    fs.writeFileSync(smallLog, original)
    runScript(taskFile, '0',
      '2024-07-01T10:00:00Z', '2024-07-01T10:00:05Z',
      '0', smallLog, stderrLog)
    assert.equal(fs.readFileSync(smallLog, 'utf8'), original)
  })

  test('deletes result files older than retentionDays', () => {
    const resultsDir = path.join(TMP, '.tide', 'tasks', taskId, 'results')
    const oldFile = path.join(resultsDir, 'old-result.json')
    fs.writeFileSync(oldFile, JSON.stringify({ taskId }))
    // backdate mtime to 40 days ago
    const oldTime = new Date(Date.now() - 40 * 86400 * 1000)
    fs.utimesSync(oldFile, oldTime, oldTime)

    runPost({ startedAt: '2024-08-01T10:00:00Z', completedAt: '2024-08-01T10:00:05Z' })
    assert.ok(!fs.existsSync(oldFile), 'old result file should have been deleted')
  })

  test('keeps result files within retentionDays', () => {
    const resultsDir = path.join(TMP, '.tide', 'tasks', taskId, 'results')
    const recentFile = path.join(resultsDir, 'recent-result.json')
    fs.writeFileSync(recentFile, JSON.stringify({ taskId }))
    // backdate mtime to 5 days ago (within 30-day retention)
    const recentTime = new Date(Date.now() - 5 * 86400 * 1000)
    fs.utimesSync(recentFile, recentTime, recentTime)

    runPost({ startedAt: '2024-09-01T10:00:00Z', completedAt: '2024-09-01T10:00:05Z' })
    assert.ok(fs.existsSync(recentFile), 'recent result file should be kept')
  })
})
