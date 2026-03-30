import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const SCRIPT = path.resolve('scripts/task-setup.js')

// ── helpers ────────────────────────────────────────────────────────────────

let TMP

function setup() {
  TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'tide-test-setup-'))
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

// ── tests ──────────────────────────────────────────────────────────────────

describe('task-setup.js', () => {
  before(() => { setup() })
  after(() => { fs.rmSync(TMP, { recursive: true, force: true }) })

  test('emits shell-eval-safe variable assignments', () => {
    const taskFile = writeTaskFile('test-task-01', { command: 'claude', maxRetries: 2 })
    const { stdout, status } = runScript(taskFile)
    assert.equal(status, 0)
    assert.match(stdout, /^COMMAND='claude'$/m)
    assert.match(stdout, /^MAX_RETRIES='2'$/m)
    assert.match(stdout, /^TASK_NAME='Test Task'$/m)
    assert.match(stdout, /^WORKING_DIR='/m)
    assert.match(stdout, /^RESULT_RETENTION_DAYS='30'$/m)
  })

  test('falls back to settings.json command when task.command is empty', () => {
    const tideDir = path.join(TMP, '.tide')
    fs.mkdirSync(tideDir, { recursive: true })
    fs.writeFileSync(
      path.join(tideDir, 'settings.json'),
      JSON.stringify({ command: 'my-fallback-cmd' })
    )
    const taskFile = writeTaskFile('test-task-01', { command: '' })
    const { stdout } = runScript(taskFile)
    assert.match(stdout, /^COMMAND='my-fallback-cmd'$/m)
  })

  test('quotes values with single quotes safely', () => {
    const taskFile = writeTaskFile('test-task-01', {
      name: "it's a task",
      command: 'claude',
    })
    const { stdout } = runScript(taskFile)
    // single quotes in the name must be escaped for shell eval
    // shell-safe: single quote escaped as '\''
    assert.ok(stdout.includes("TASK_NAME='it'\\''s a task'"), `unexpected: ${stdout}`)
  })

  test('emits EXTRA_ARGS with joined extraArgs', () => {
    const taskFile = writeTaskFile('test-task-01', {
      command: 'claude',
      extraArgs: ['--dangerously-skip-permissions', '--no-cache'],
    })
    const { stdout } = runScript(taskFile)
    assert.match(stdout, /^EXTRA_ARGS='--dangerously-skip-permissions --no-cache'$/m)
  })
})
