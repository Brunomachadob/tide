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
  fs.mkdirSync(taskDir, { recursive: true })
  return taskId
}

function writeTaskMd(taskId, overrides = {}) {
  const tideRepoDir = path.join(TMP, 'repo', '.tide')
  fs.mkdirSync(tideRepoDir, { recursive: true })
  // Also ensure the task runs dir exists
  fs.mkdirSync(path.join(TMP, '.tide', 'tasks', taskId, 'runs'), { recursive: true })

  const {
    command = '',
    maxRetries = 0,
    workingDirectory = TMP,
    resultRetentionDays = 30,
    extraArgs = [],
    claudeStreamJson = false,
    argument = '',
    parentRunId,
    name = 'Test Task',
    jitter = 0,
    ...rest
  } = overrides

  const frontmatter = [
    `_id: ${taskId}`,
    `_jitter: ${jitter}`,
    `_enabled: true`,
    `name: ${name}`,
    ...(command ? [`command: ${command}`] : []),
    `maxRetries: ${maxRetries}`,
    `workingDirectory: ${workingDirectory}`,
    `resultRetentionDays: ${resultRetentionDays}`,
    ...(extraArgs.length ? [`extraArgs: [${extraArgs.map(a => JSON.stringify(a)).join(', ')}]`] : []),
    ...(claudeStreamJson ? ['claudeStreamJson: true'] : []),
    ...(parentRunId ? [`parentRunId: ${parentRunId}`] : []),
    ...Object.entries(rest).map(([k, v]) => `${k}: ${JSON.stringify(v)}`),
  ].join('\n')

  const content = `---\n${frontmatter}\n---\n\n${argument}`
  const mdPath = path.join(tideRepoDir, `${taskId}.md`)
  fs.writeFileSync(mdPath, content)
  return mdPath
}

function runScript(mdPath) {
  return spawnSync('node', [SCRIPT, mdPath], {
    encoding: 'utf8',
    env: { ...process.env, HOME: TMP, TIDE_TASK_FILE: mdPath },
  })
}

// ── tests ──────────────────────────────────────────────────────────────────

describe('task-setup.js', () => {
  before(() => { setup() })
  after(() => { fs.rmSync(TMP, { recursive: true, force: true }) })

  test('emits shell-eval-safe variable assignments', () => {
    const mdPath = writeTaskMd('test-task-01', { command: 'claude', maxRetries: 2 })
    const { stdout, status } = runScript(mdPath)
    assert.equal(status, 0)
    assert.match(stdout, /^COMMAND='claude'$/m)
    assert.match(stdout, /^MAX_RETRIES='2'$/m)
    assert.match(stdout, /^TASK_NAME='Test Task'$/m)
    assert.match(stdout, /^WORKING_DIR='/m)
    assert.match(stdout, /^RESULT_RETENTION_DAYS='30'$/m)
  })

  test('emits RUN_ID, RUN_DIR, and STARTED_AT', () => {
    const mdPath = writeTaskMd('test-task-01', { command: 'claude' })
    const { stdout, status } = runScript(mdPath)
    assert.equal(status, 0)
    assert.match(stdout, /^RUN_ID='[0-9a-f]{8}'$/m)
    assert.match(stdout, /^RUN_DIR='/m)
    assert.match(stdout, /^STARTED_AT='/m)
  })

  test('creates the run directory and writes initial run.json', () => {
    const mdPath = writeTaskMd('test-task-01', { command: 'claude' })
    const { stdout, status } = runScript(mdPath)
    assert.equal(status, 0)

    const runIdMatch = stdout.match(/^RUN_ID='([0-9a-f]{8})'$/m)
    assert.ok(runIdMatch, 'RUN_ID not found in output')
    const runId = runIdMatch[1]

    const runDir = path.join(TMP, '.tide', 'tasks', 'test-task-01', 'runs', runId)
    assert.ok(fs.existsSync(runDir), 'run directory should be created')

    const runJson = JSON.parse(fs.readFileSync(path.join(runDir, 'run.json'), 'utf8'))
    assert.equal(runJson.runId, runId)
    assert.equal(runJson.taskId, 'test-task-01')
    assert.ok(runJson.startedAt, 'startedAt should be present')
    assert.equal(runJson.completedAt, undefined, 'completedAt should not be set yet')
  })

  test('falls back to settings.json command when task command is empty', () => {
    const tideDir = path.join(TMP, '.tide')
    fs.mkdirSync(tideDir, { recursive: true })
    fs.writeFileSync(
      path.join(tideDir, 'settings.json'),
      JSON.stringify({ command: 'my-fallback-cmd' })
    )
    const mdPath = writeTaskMd('test-task-01', { command: '' })
    const { stdout } = runScript(mdPath)
    assert.match(stdout, /^COMMAND='my-fallback-cmd'$/m)
  })

  test('quotes values with single quotes safely', () => {
    const mdPath = writeTaskMd('test-task-01', {
      name: "it's a task",
      command: 'claude',
    })
    const { stdout } = runScript(mdPath)
    assert.ok(stdout.includes("TASK_NAME='it'\\''s a task'"), `unexpected: ${stdout}`)
  })

  test('emits EXTRA_ARGS with joined extraArgs', () => {
    const mdPath = writeTaskMd('test-task-01', {
      command: 'claude',
      extraArgs: ['--dangerously-skip-permissions', '--no-cache'],
    })
    const { stdout } = runScript(mdPath)
    assert.match(stdout, /^EXTRA_ARGS='--dangerously-skip-permissions --no-cache'$/m)
  })

  test('emits TERMINAL_BUNDLE_ID from settings.json', () => {
    const tideDir = path.join(TMP, '.tide')
    fs.mkdirSync(tideDir, { recursive: true })
    fs.writeFileSync(
      path.join(tideDir, 'settings.json'),
      JSON.stringify({ command: 'claude', terminalBundleId: 'com.googlecode.iterm2' })
    )
    const mdPath = writeTaskMd('test-task-01', { command: 'claude' })
    const { stdout } = runScript(mdPath)
    assert.match(stdout, /^TERMINAL_BUNDLE_ID='com\.googlecode\.iterm2'$/m)
  })

  test('emits default TERMINAL_BUNDLE_ID when not in settings', () => {
    const tideDir = path.join(TMP, '.tide')
    fs.writeFileSync(path.join(tideDir, 'settings.json'), JSON.stringify({ command: 'claude' }))
    const mdPath = writeTaskMd('test-task-01', { command: 'claude' })
    const { stdout } = runScript(mdPath)
    assert.match(stdout, /^TERMINAL_BUNDLE_ID='com\.apple\.Terminal'$/m)
  })

  test('emits CLAUDE_STREAM_JSON=1 when claudeStreamJson is true', () => {
    const mdPath = writeTaskMd('test-task-01', { command: 'claude', claudeStreamJson: true })
    const { stdout } = runScript(mdPath)
    assert.match(stdout, /^CLAUDE_STREAM_JSON='1'$/m)
  })

  test('emits CLAUDE_STREAM_JSON=0 when claudeStreamJson is false or absent', () => {
    const mdPath = writeTaskMd('test-task-01', { command: 'claude' })
    const { stdout } = runScript(mdPath)
    assert.match(stdout, /^CLAUDE_STREAM_JSON='0'$/m)
  })

  test('writes argument to run.json', () => {
    const mdPath = writeTaskMd('test-task-01', { command: 'claude', argument: 'do something' })
    const { stdout, status } = runScript(mdPath)
    assert.equal(status, 0)

    const runIdMatch = stdout.match(/^RUN_ID='([0-9a-f]{8})'$/m)
    assert.ok(runIdMatch)
    const runId = runIdMatch[1]

    const runDir = path.join(TMP, '.tide', 'tasks', 'test-task-01', 'runs', runId)
    const runJson = JSON.parse(fs.readFileSync(path.join(runDir, 'run.json'), 'utf8'))
    assert.equal(runJson.argument, 'do something')
  })

  test('writes parentRunId to run.json when present in frontmatter', () => {
    const mdPath = writeTaskMd('test-task-01', { command: 'claude', argument: 'follow up', parentRunId: 'abc12345' })
    const { stdout, status } = runScript(mdPath)
    assert.equal(status, 0)

    const runIdMatch = stdout.match(/^RUN_ID='([0-9a-f]{8})'$/m)
    assert.ok(runIdMatch)
    const runId = runIdMatch[1]

    const runDir = path.join(TMP, '.tide', 'tasks', 'test-task-01', 'runs', runId)
    const runJson = JSON.parse(fs.readFileSync(path.join(runDir, 'run.json'), 'utf8'))
    assert.equal(runJson.parentRunId, 'abc12345')
  })

  test('omits parentRunId from run.json when not in frontmatter', () => {
    const mdPath = writeTaskMd('test-task-01', { command: 'claude', argument: 'hello' })
    const { stdout, status } = runScript(mdPath)
    assert.equal(status, 0)

    const runIdMatch = stdout.match(/^RUN_ID='([0-9a-f]{8})'$/m)
    assert.ok(runIdMatch)
    const runId = runIdMatch[1]

    const runDir = path.join(TMP, '.tide', 'tasks', 'test-task-01', 'runs', runId)
    const runJson = JSON.parse(fs.readFileSync(path.join(runDir, 'run.json'), 'utf8'))
    assert.equal(runJson.parentRunId, undefined)
  })

  test('emits JITTER_SECONDS from _jitter frontmatter', () => {
    const mdPath = writeTaskMd('test-task-01', { command: 'claude', jitter: 42 })
    const { stdout } = runScript(mdPath)
    assert.match(stdout, /^JITTER_SECONDS='42'$/m)
  })
})
