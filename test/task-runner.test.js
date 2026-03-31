import { test, describe, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const SCRIPT = path.resolve('scripts/task-runner.sh')

// ── helpers ────────────────────────────────────────────────────────────────

function makeTmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'tide-test-runner-'))
}

function makeTask(tmp, taskId, overrides = {}) {
  const taskDir = path.join(tmp, '.tide', 'tasks', taskId)
  fs.mkdirSync(path.join(taskDir, 'results'), { recursive: true })
  fs.mkdirSync(path.join(taskDir, 'logs'), { recursive: true })

  const task = {
    id: taskId,
    name: 'Test Task',
    argument: 'Do something useful.',
    command: '', // filled in per-test via a fake command script
    extraArgs: [],
    maxRetries: 0,
    workingDirectory: tmp,
    resultRetentionDays: 30,
    ...overrides,
  }
  fs.writeFileSync(path.join(taskDir, 'task.json'), JSON.stringify(task, null, 2))
  return taskDir
}

function makeFakeCommand(tmp, { exitCode = 0, output = 'fake output' } = {}) {
  const script = path.join(tmp, 'fake-cmd.sh')
  fs.writeFileSync(script, `#!/bin/sh\necho '${output}'\nexit ${exitCode}\n`)
  fs.chmodSync(script, 0o755)
  return script
}

function makeFakeStreamCommand(tmp, { exitCode = 0, text = 'streamed output' } = {}) {
  const ndjson = [
    JSON.stringify({ type: 'stream_event', event: { type: 'message_start' } }),
    JSON.stringify({ type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'text_delta', text } } }),
    JSON.stringify({ type: 'stream_event', event: { type: 'message_stop' } }),
    JSON.stringify({ type: 'result', result: text }),
  ].join('\n')
  const script = path.join(tmp, 'fake-stream-cmd.sh')
  fs.writeFileSync(script, `#!/bin/sh\nprintf '${ndjson.replace(/'/g, "'\\''")}'\nexit ${exitCode}\n`)
  fs.chmodSync(script, 0o755)
  return script
}

function runRunner(tmp, taskId) {
  return spawnSync('zsh', [SCRIPT, taskId], {
    encoding: 'utf8',
    env: {
      ...process.env,
      HOME: tmp,
      PATH: process.env.PATH,
      TIDE_NO_NOTIFY: '1',
    },
    timeout: 15000,
  })
}

function resultsDir(tmp, taskId) {
  return path.join(tmp, '.tide', 'tasks', taskId, 'results')
}

function readLatestResult(tmp, taskId) {
  const dir = resultsDir(tmp, taskId)
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort()
  if (!files.length) return null
  return JSON.parse(fs.readFileSync(path.join(dir, files[files.length - 1]), 'utf8'))
}

// ── tests ──────────────────────────────────────────────────────────────────

describe('task-runner.sh', () => {
  test('exits 1 with no task ID argument', () => {
    const tmp = makeTmp()
    after(() => fs.rmSync(tmp, { recursive: true, force: true }))
    const { status, stderr } = spawnSync('zsh', [SCRIPT], {
      encoding: 'utf8',
      env: { ...process.env, HOME: tmp },
      timeout: 5000,
    })
    assert.notEqual(status, 0)
    assert.match(stderr, /requires a task ID/)
  })

  test('exits 1 when task file is missing', () => {
    const tmp = makeTmp()
    after(() => fs.rmSync(tmp, { recursive: true, force: true }))
    const taskId = 'no-task'
    const taskDir = path.join(tmp, '.tide', 'tasks', taskId)
    fs.mkdirSync(path.join(taskDir, 'results'), { recursive: true })
    fs.mkdirSync(path.join(taskDir, 'logs'), { recursive: true })
    // no task.json
    const { status } = runRunner(tmp, taskId)
    assert.equal(status, 1)
  })


  test('successful run writes a result file with exitCode 0', () => {
    const tmp = makeTmp()
    after(() => fs.rmSync(tmp, { recursive: true, force: true }))
    const taskId = 'success-task'
    const fakeCmd = makeFakeCommand(tmp, { exitCode: 0, output: 'all good' })
    makeTask(tmp, taskId, { command: fakeCmd })

    const { status } = runRunner(tmp, taskId)
    assert.equal(status, 0)

    const result = readLatestResult(tmp, taskId)
    assert.ok(result, 'result file should exist')
    assert.equal(result.exitCode, 0)
    assert.equal(result.taskId, taskId)
    assert.ok(result.startedAt)
    assert.ok(result.completedAt)
  })

  test('failed run writes a result file with non-zero exitCode', () => {
    const tmp = makeTmp()
    after(() => fs.rmSync(tmp, { recursive: true, force: true }))
    const taskId = 'fail-task'
    const fakeCmd = makeFakeCommand(tmp, { exitCode: 1, output: 'something broke' })
    makeTask(tmp, taskId, { command: fakeCmd })

    runRunner(tmp, taskId)

    const result = readLatestResult(tmp, taskId)
    assert.ok(result, 'result file should exist')
    assert.equal(result.exitCode, 1)
  })

  test('appends run header to output.log', () => {
    const tmp = makeTmp()
    after(() => fs.rmSync(tmp, { recursive: true, force: true }))
    const taskId = 'log-task'
    const fakeCmd = makeFakeCommand(tmp, { output: 'log me' })
    makeTask(tmp, taskId, { command: fakeCmd })

    runRunner(tmp, taskId)

    const log = fs.readFileSync(
      path.join(tmp, '.tide', 'tasks', taskId, 'logs', 'output.log'), 'utf8'
    )
    assert.match(log, /=== \d{4}-\d{2}-\d{2}T/)
  })

  test('cleans up PID file after successful run', () => {
    const tmp = makeTmp()
    after(() => fs.rmSync(tmp, { recursive: true, force: true }))
    const taskId = 'pid-task'
    const fakeCmd = makeFakeCommand(tmp)
    makeTask(tmp, taskId, { command: fakeCmd })

    runRunner(tmp, taskId)

    const pidFile = path.join(tmp, '.tide', 'tasks', taskId, 'running.pid')
    assert.ok(!fs.existsSync(pidFile), 'PID file should be removed after run')
  })

  test('cleans up PID file after failed run', () => {
    const tmp = makeTmp()
    after(() => fs.rmSync(tmp, { recursive: true, force: true }))
    const taskId = 'pid-fail-task'
    const fakeCmd = makeFakeCommand(tmp, { exitCode: 1 })
    makeTask(tmp, taskId, { command: fakeCmd })

    runRunner(tmp, taskId)

    const pidFile = path.join(tmp, '.tide', 'tasks', taskId, 'running.pid')
    assert.ok(!fs.existsSync(pidFile), 'PID file should be removed even after failed run')
  })

  test('skips run when a PID file with a live process exists', () => {
    const tmp = makeTmp()
    after(() => fs.rmSync(tmp, { recursive: true, force: true }))
    const taskId = 'overlap-task'
    const fakeCmd = makeFakeCommand(tmp)
    makeTask(tmp, taskId, { command: fakeCmd })

    // Write a PID file pointing to a real running process (this test process)
    const pidFile = path.join(tmp, '.tide', 'tasks', taskId, 'running.pid')
    fs.writeFileSync(pidFile, String(process.pid))

    const { status, stderr } = runRunner(tmp, taskId)
    assert.equal(status, 0) // exits 0 (skip is not an error)
    assert.match(stderr, /Skipping/)

    // No result should be written since the run was skipped
    const results = fs.readdirSync(resultsDir(tmp, taskId)).filter(f => f.endsWith('.json'))
    assert.equal(results.length, 0)
  })

  test('removes stale PID file and proceeds when PID is dead', () => {
    const tmp = makeTmp()
    after(() => fs.rmSync(tmp, { recursive: true, force: true }))
    const taskId = 'stale-pid-task'
    const fakeCmd = makeFakeCommand(tmp, { exitCode: 0 })
    makeTask(tmp, taskId, { command: fakeCmd })

    // PID 99999 is virtually guaranteed to not exist
    const pidFile = path.join(tmp, '.tide', 'tasks', taskId, 'running.pid')
    fs.writeFileSync(pidFile, '99999')

    const { status } = runRunner(tmp, taskId)
    assert.equal(status, 0)

    const result = readLatestResult(tmp, taskId)
    assert.ok(result, 'should have run despite stale PID file')
    assert.equal(result.exitCode, 0)
  })

  test('records attempts=1 when maxRetries=0 and command fails', () => {
    const tmp = makeTmp()
    after(() => fs.rmSync(tmp, { recursive: true, force: true }))
    const taskId = 'no-retry-task'
    const fakeCmd = makeFakeCommand(tmp, { exitCode: 1 })
    makeTask(tmp, taskId, { command: fakeCmd, maxRetries: 0 })

    runRunner(tmp, taskId)

    const result = readLatestResult(tmp, taskId)
    assert.ok(result)
    assert.equal(result.exitCode, 1)
    assert.equal(result.attempts, 1)
  })

  test('records attempts=1 when maxRetries=0 and command succeeds', () => {
    const tmp = makeTmp()
    after(() => fs.rmSync(tmp, { recursive: true, force: true }))
    const taskId = 'success-attempt-task'
    const fakeCmd = makeFakeCommand(tmp, { exitCode: 0 })
    makeTask(tmp, taskId, { command: fakeCmd, maxRetries: 0 })

    runRunner(tmp, taskId)

    const result = readLatestResult(tmp, taskId)
    assert.ok(result)
    assert.equal(result.exitCode, 0)
    assert.equal(result.attempts, 1)
  })

  test('stream mode extracts text from stream-json output', () => {
    const tmp = makeTmp()
    after(() => fs.rmSync(tmp, { recursive: true, force: true }))
    const taskId = 'stream-task'
    const fakeCmd = makeFakeStreamCommand(tmp, { exitCode: 0, text: 'hello stream' })
    makeTask(tmp, taskId, { command: fakeCmd, claudeStreamJson: true })

    const { status } = runRunner(tmp, taskId)
    assert.equal(status, 0)

    const log = fs.readFileSync(
      path.join(tmp, '.tide', 'tasks', taskId, 'logs', 'output.log'), 'utf8'
    )
    assert.ok(log.includes('hello stream'), `expected "hello stream" in log, got: ${log}`)
    assert.ok(!log.includes('"type"'), 'log should not contain raw JSON')
  })

  test('stream mode preserves exit code from the command', () => {
    const tmp = makeTmp()
    after(() => fs.rmSync(tmp, { recursive: true, force: true }))
    const taskId = 'stream-fail-task'
    const fakeCmd = makeFakeStreamCommand(tmp, { exitCode: 1, text: 'oops' })
    makeTask(tmp, taskId, { command: fakeCmd, claudeStreamJson: true })

    runRunner(tmp, taskId)

    const result = readLatestResult(tmp, taskId)
    assert.ok(result)
    assert.equal(result.exitCode, 1)
  })
})
