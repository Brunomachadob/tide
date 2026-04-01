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
  fs.mkdirSync(taskDir, { recursive: true })
  return taskId
}

function writeTaskMd(taskId, overrides = {}) {
  const repoTideDir = path.join(TMP, 'repo', '.tide')
  fs.mkdirSync(repoTideDir, { recursive: true })
  const {
    name = 'Test Task',
    resultRetentionDays = 30,
    ...rest
  } = overrides

  const frontmatter = [
    `_id: ${taskId}`,
    `_enabled: true`,
    `name: ${name}`,
    `resultRetentionDays: ${resultRetentionDays}`,
    ...Object.entries(rest).map(([k, v]) => `${k}: ${JSON.stringify(v)}`),
  ].join('\n')

  const mdPath = path.join(repoTideDir, `${taskId}.md`)
  fs.writeFileSync(mdPath, `---\n${frontmatter}\n---\n\nsome argument`)
  return mdPath
}

function makeRunDir(taskId, runId, startedAt = new Date().toISOString()) {
  const runDir = path.join(TMP, '.tide', 'tasks', taskId, 'runs', runId)
  fs.mkdirSync(runDir, { recursive: true })
  fs.writeFileSync(path.join(runDir, 'run.json'), JSON.stringify({
    runId,
    taskId,
    taskName: 'Test Task',
    startedAt,
  }, null, 2))
  fs.writeFileSync(path.join(runDir, 'output.log'), '')
  fs.writeFileSync(path.join(runDir, 'stderr.log'), '')
  return runDir
}

function runScript(...args) {
  return spawnSync('node', [SCRIPT, ...args], {
    encoding: 'utf8',
    env: { ...process.env, HOME: TMP },
  })
}

function notifDir() {
  return path.join(TMP, '.tide', 'notifications')
}

function readNotifDir() {
  const dir = notifDir()
  try {
    return fs.readdirSync(dir)
      .filter(f => f.endsWith('.json') && !f.endsWith('.tmp'))
      .map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')))
  } catch {
    return []
  }
}

// ── tests ──────────────────────────────────────────────────────────────────

describe('task-postprocess', () => {
  let taskId
  let taskFile

  before(() => {
    taskId = setup()
    taskFile = writeTaskMd(taskId)
  })

  after(() => { fs.rmSync(TMP, { recursive: true, force: true }) })

  function runPost(runId, overrides = {}) {
    const now = new Date().toISOString()
    const defaults = {
      exitCode: '0',
      startedAt: now,
      completedAt: now,
      attempts: '1',
    }
    const o = { ...defaults, ...overrides }
    const runDir = makeRunDir(taskId, runId, o.startedAt)
    return { result: runScript(taskFile, o.exitCode, o.startedAt, o.completedAt, o.attempts, runDir), runDir }
  }

  test('completes run.json with exit metadata', () => {
    const { result, runDir } = runPost('run-complete-01', { exitCode: '0' })
    assert.equal(result.status, 0)
    const run = JSON.parse(fs.readFileSync(path.join(runDir, 'run.json'), 'utf8'))
    assert.equal(run.taskId, taskId)
    assert.equal(run.exitCode, 0)
    assert.equal(run.attempts, 1)
    assert.ok(run.completedAt, 'completedAt should be set')
    assert.ok(run.runId, 'runId should be present')
  })

  test('writes notification to spool directory', () => {
    runPost('run-notif-01', { exitCode: '1' })
    const entries = readNotifDir()
    const entry = entries.find(e => e.runId === 'run-notif-01')
    assert.ok(entry, 'notification file should exist for run-notif-01')
    assert.equal(entry.taskId, taskId)
    assert.equal(entry.exitCode, 1)
    assert.ok(entry.completedAt)
    assert.equal(entry.read, false)
  })

  test('two concurrent runs each produce their own notification file', () => {
    runPost('run-notif-02')
    runPost('run-notif-03')
    const entries = readNotifDir()
    assert.ok(entries.some(e => e.runId === 'run-notif-02'), 'run-notif-02 should have a notification')
    assert.ok(entries.some(e => e.runId === 'run-notif-03'), 'run-notif-03 should have a notification')
  })

  test('truncates output summary to 300 chars in notification', () => {
    const runId = 'run-truncate-01'
    const now = new Date().toISOString()
    const runDir = makeRunDir(taskId, runId, now)
    fs.writeFileSync(path.join(runDir, 'output.log'), 'x'.repeat(500))
    runScript(taskFile, '0', now, now, '1', runDir)
    const entry = JSON.parse(fs.readFileSync(path.join(notifDir(), `${runId}.json`), 'utf8'))
    assert.equal(entry.summary.length, 300)
  })

  test('rotates output log when it exceeds 5MB', () => {
    const runId = 'run-rotate-01'
    const now = new Date().toISOString()
    const runDir = makeRunDir(taskId, runId, now)
    const outputLog = path.join(runDir, 'output.log')
    fs.writeFileSync(outputLog, Buffer.alloc(5 * 1024 * 1024 + 100, 'a'))
    runScript(taskFile, '0', now, now, '1', runDir)
    const content = fs.readFileSync(outputLog, 'utf8')
    assert.ok(content.startsWith('[... rotated ...]'))
    assert.ok(content.length < 5 * 1024 * 1024)
  })

  test('does not rotate log under 5MB', () => {
    const runId = 'run-norotate-01'
    const now = new Date().toISOString()
    const runDir = makeRunDir(taskId, runId, now)
    const outputLog = path.join(runDir, 'output.log')
    const original = 'line1\nline2\n'
    fs.writeFileSync(outputLog, original)
    runScript(taskFile, '0', now, now, '1', runDir)
    assert.equal(fs.readFileSync(outputLog, 'utf8'), original)
  })

  test('deletes run directories older than retentionDays', () => {
    const oldRunId = 'run-old-01'
    const oldRunDir = path.join(TMP, '.tide', 'tasks', taskId, 'runs', oldRunId)
    fs.mkdirSync(oldRunDir, { recursive: true })
    const oldStartedAt = new Date(Date.now() - 40 * 86400 * 1000).toISOString()
    fs.writeFileSync(path.join(oldRunDir, 'run.json'), JSON.stringify({
      runId: oldRunId, taskId, startedAt: oldStartedAt, completedAt: oldStartedAt, exitCode: 0,
    }))

    runPost('run-retention-01', { startedAt: '2024-08-01T10:00:00Z', completedAt: '2024-08-01T10:00:05Z' })
    assert.ok(!fs.existsSync(oldRunDir), 'old run directory should have been deleted')
  })

  test('keeps run directories within retentionDays', () => {
    const recentRunId = 'run-recent-01'
    const recentRunDir = path.join(TMP, '.tide', 'tasks', taskId, 'runs', recentRunId)
    fs.mkdirSync(recentRunDir, { recursive: true })
    const recentStartedAt = new Date(Date.now() - 5 * 86400 * 1000).toISOString()
    fs.writeFileSync(path.join(recentRunDir, 'run.json'), JSON.stringify({
      runId: recentRunId, taskId, startedAt: recentStartedAt, completedAt: recentStartedAt, exitCode: 0,
    }))

    runPost('run-retention-02', { startedAt: '2024-09-01T10:00:00Z', completedAt: '2024-09-01T10:00:05Z' })
    assert.ok(fs.existsSync(recentRunDir), 'recent run directory should be kept')
  })
})
