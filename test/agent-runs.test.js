import { test, describe, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'tide-test-runs-'))
// tideDir is passed explicitly — no HOME override needed

const { initRun, completeRun, spoolNotification, pruneOldRuns } =
  await import('../scripts/lib/agent-runs.js?bust=1')

const TIDE_DIR = TMP

describe('initRun()', () => {
  test('creates the run directory', () => {
    initRun(TIDE_DIR, 'task1', 'My Task', 'run001', '2024-01-01T09:00:00Z', 'do stuff', undefined)
    assert.ok(fs.existsSync(path.join(TIDE_DIR, 'tasks', 'task1', 'runs', 'run001')))
  })

  test('writes initial run.json with correct fields', () => {
    initRun(TIDE_DIR, 'task2', 'Task Two', 'run002', '2024-01-01T10:00:00Z', 'do things', undefined)
    const run = JSON.parse(fs.readFileSync(
      path.join(TIDE_DIR, 'tasks', 'task2', 'runs', 'run002', 'run.json'), 'utf8'
    ))
    assert.equal(run.runId, 'run002')
    assert.equal(run.taskId, 'task2')
    assert.equal(run.taskName, 'Task Two')
    assert.equal(run.startedAt, '2024-01-01T10:00:00Z')
    assert.equal(run.argument, 'do things')
  })

  test('initial run.json does not have completedAt or exitCode', () => {
    initRun(TIDE_DIR, 'task3', 'Task Three', 'run003', '2024-01-01T11:00:00Z', 'arg', undefined)
    const run = JSON.parse(fs.readFileSync(
      path.join(TIDE_DIR, 'tasks', 'task3', 'runs', 'run003', 'run.json'), 'utf8'
    ))
    assert.equal(run.completedAt, undefined)
    assert.equal(run.exitCode, undefined)
  })

  test('includes parentRunId when provided', () => {
    initRun(TIDE_DIR, 'task4', 'Task Four', 'run004', '2024-01-01T12:00:00Z', 'arg', 'parent-001')
    const run = JSON.parse(fs.readFileSync(
      path.join(TIDE_DIR, 'tasks', 'task4', 'runs', 'run004', 'run.json'), 'utf8'
    ))
    assert.equal(run.parentRunId, 'parent-001')
  })

  test('omits parentRunId when not provided', () => {
    initRun(TIDE_DIR, 'task5', 'Task Five', 'run005', '2024-01-01T13:00:00Z', 'arg', undefined)
    const run = JSON.parse(fs.readFileSync(
      path.join(TIDE_DIR, 'tasks', 'task5', 'runs', 'run005', 'run.json'), 'utf8'
    ))
    assert.equal(run.parentRunId, undefined)
  })

  test('returns { runDir, runFile, outputLog, stderrLog } with correct paths', () => {
    const result = initRun(TIDE_DIR, 'task6', 'Task Six', 'run006', '2024-01-01T14:00:00Z', 'arg', undefined)
    const base = path.join(TIDE_DIR, 'tasks', 'task6', 'runs', 'run006')
    assert.equal(result.runDir, base)
    assert.equal(result.runFile, path.join(base, 'run.json'))
    assert.equal(result.outputLog, path.join(base, 'output.log'))
    assert.equal(result.stderrLog, path.join(base, 'stderr.log'))
  })
})

describe('completeRun()', () => {
  test('overwrites run.json with completed record', () => {
    const { runFile } = initRun(TIDE_DIR, 'ctask1', 'CTask', 'crun001', '2024-01-01T09:00:00Z', 'arg', undefined)
    completeRun(runFile, {
      runId: 'crun001', taskId: 'ctask1', taskName: 'CTask',
      startedAt: '2024-01-01T09:00:00Z', completedAt: '2024-01-01T09:01:00Z',
      exitCode: 0, attempts: 1, argument: 'arg', parentRunId: undefined,
    })
    const run = JSON.parse(fs.readFileSync(runFile, 'utf8'))
    assert.equal(run.completedAt, '2024-01-01T09:01:00Z')
    assert.equal(run.exitCode, 0)
    assert.equal(run.attempts, 1)
  })

  test('includes parentRunId in completed record when provided', () => {
    const { runFile } = initRun(TIDE_DIR, 'ctask2', 'CTask2', 'crun002', '2024-01-01T09:00:00Z', 'arg', undefined)
    completeRun(runFile, {
      runId: 'crun002', taskId: 'ctask2', taskName: 'CTask2',
      startedAt: '2024-01-01T09:00:00Z', completedAt: '2024-01-01T09:01:00Z',
      exitCode: 1, attempts: 2, argument: 'arg', parentRunId: 'parent-xyz',
    })
    const run = JSON.parse(fs.readFileSync(runFile, 'utf8'))
    assert.equal(run.parentRunId, 'parent-xyz')
  })

  test('write is atomic — no .tmp file remains', () => {
    const { runFile } = initRun(TIDE_DIR, 'ctask3', 'CTask3', 'crun003', '2024-01-01T09:00:00Z', 'arg', undefined)
    completeRun(runFile, {
      runId: 'crun003', taskId: 'ctask3', taskName: 'CTask3',
      startedAt: '2024-01-01T09:00:00Z', completedAt: '2024-01-01T09:01:00Z',
      exitCode: 0, attempts: 1, argument: 'arg', parentRunId: undefined,
    })
    assert.ok(!fs.existsSync(runFile + '.tmp'))
  })
})

describe('spoolNotification()', () => {
  test('creates the notification file', () => {
    initRun(TIDE_DIR, 'ntask1', 'NTask', 'nrun001', '2024-01-01T09:00:00Z', 'arg', undefined)
    const runFile = path.join(TIDE_DIR, 'tasks', 'ntask1', 'runs', 'nrun001', 'run.json')
    const outputLog = path.join(TIDE_DIR, 'tasks', 'ntask1', 'runs', 'nrun001', 'output.log')
    spoolNotification(TIDE_DIR, {
      taskId: 'ntask1', taskName: 'NTask', runId: 'nrun001',
      completedAt: '2024-01-01T09:01:00Z', exitCode: 0, runFile, outputLog,
    })
    assert.ok(fs.existsSync(path.join(TIDE_DIR, 'notifications', 'nrun001.json')))
  })

  test('spool file has correct fields', () => {
    initRun(TIDE_DIR, 'ntask2', 'NTask2', 'nrun002', '2024-01-01T09:00:00Z', 'arg', undefined)
    const runFile = path.join(TIDE_DIR, 'tasks', 'ntask2', 'runs', 'nrun002', 'run.json')
    const outputLog = path.join(TIDE_DIR, 'tasks', 'ntask2', 'runs', 'nrun002', 'output.log')
    spoolNotification(TIDE_DIR, {
      taskId: 'ntask2', taskName: 'NTask2', runId: 'nrun002',
      completedAt: '2024-01-01T09:01:00Z', exitCode: 1, runFile, outputLog,
    })
    const n = JSON.parse(fs.readFileSync(path.join(TIDE_DIR, 'notifications', 'nrun002.json'), 'utf8'))
    assert.equal(n.taskId, 'ntask2')
    assert.equal(n.taskName, 'NTask2')
    assert.equal(n.runId, 'nrun002')
    assert.equal(n.completedAt, '2024-01-01T09:01:00Z')
    assert.equal(n.exitCode, 1)
    assert.equal(n.resultFile, runFile)
    assert.equal(n.read, false)
  })

  test('summary is at most 300 chars', () => {
    initRun(TIDE_DIR, 'ntask3', 'NTask3', 'nrun003', '2024-01-01T09:00:00Z', 'arg', undefined)
    const runFile = path.join(TIDE_DIR, 'tasks', 'ntask3', 'runs', 'nrun003', 'run.json')
    const outputLog = path.join(TIDE_DIR, 'tasks', 'ntask3', 'runs', 'nrun003', 'output.log')
    fs.writeFileSync(outputLog, 'x'.repeat(1000))
    spoolNotification(TIDE_DIR, {
      taskId: 'ntask3', taskName: 'NTask3', runId: 'nrun003',
      completedAt: '2024-01-01T09:01:00Z', exitCode: 0, runFile, outputLog,
    })
    const n = JSON.parse(fs.readFileSync(path.join(TIDE_DIR, 'notifications', 'nrun003.json'), 'utf8'))
    assert.ok(n.summary.length <= 300)
  })

  test('summary comes from the last bytes of outputLog', () => {
    initRun(TIDE_DIR, 'ntask4', 'NTask4', 'nrun004', '2024-01-01T09:00:00Z', 'arg', undefined)
    const runFile = path.join(TIDE_DIR, 'tasks', 'ntask4', 'runs', 'nrun004', 'run.json')
    const outputLog = path.join(TIDE_DIR, 'tasks', 'ntask4', 'runs', 'nrun004', 'output.log')
    fs.writeFileSync(outputLog, 'start'.repeat(100) + 'THE END')
    spoolNotification(TIDE_DIR, {
      taskId: 'ntask4', taskName: 'NTask4', runId: 'nrun004',
      completedAt: '2024-01-01T09:01:00Z', exitCode: 0, runFile, outputLog,
    })
    const n = JSON.parse(fs.readFileSync(path.join(TIDE_DIR, 'notifications', 'nrun004.json'), 'utf8'))
    assert.ok(n.summary.endsWith('THE END'))
  })

  test('summary is empty string when outputLog does not exist', () => {
    initRun(TIDE_DIR, 'ntask5', 'NTask5', 'nrun005', '2024-01-01T09:00:00Z', 'arg', undefined)
    const runFile = path.join(TIDE_DIR, 'tasks', 'ntask5', 'runs', 'nrun005', 'run.json')
    const outputLog = path.join(TIDE_DIR, 'tasks', 'ntask5', 'runs', 'nrun005', 'output.log')
    spoolNotification(TIDE_DIR, {
      taskId: 'ntask5', taskName: 'NTask5', runId: 'nrun005',
      completedAt: '2024-01-01T09:01:00Z', exitCode: 0, runFile, outputLog,
    })
    const n = JSON.parse(fs.readFileSync(path.join(TIDE_DIR, 'notifications', 'nrun005.json'), 'utf8'))
    assert.equal(n.summary, '')
  })

  test('write is atomic — no .tmp file remains', () => {
    initRun(TIDE_DIR, 'ntask6', 'NTask6', 'nrun006', '2024-01-01T09:00:00Z', 'arg', undefined)
    const runFile = path.join(TIDE_DIR, 'tasks', 'ntask6', 'runs', 'nrun006', 'run.json')
    const outputLog = path.join(TIDE_DIR, 'tasks', 'ntask6', 'runs', 'nrun006', 'output.log')
    spoolNotification(TIDE_DIR, {
      taskId: 'ntask6', taskName: 'NTask6', runId: 'nrun006',
      completedAt: '2024-01-01T09:01:00Z', exitCode: 0, runFile, outputLog,
    })
    assert.ok(!fs.existsSync(path.join(TIDE_DIR, 'notifications', 'nrun006.json.tmp')))
  })
})

describe('pruneOldRuns()', () => {
  function makeRun(tideDir, taskId, runId, startedAt) {
    const dir = path.join(tideDir, 'tasks', taskId, 'runs', runId)
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'run.json'), JSON.stringify({ startedAt }))
    return dir
  }

  test('deletes run directories older than retentionDays', () => {
    const old = makeRun(TIDE_DIR, 'ptask1', 'old-run', new Date(Date.now() - 40 * 86400 * 1000).toISOString())
    pruneOldRuns(TIDE_DIR, 'ptask1', 30)
    assert.ok(!fs.existsSync(old))
  })

  test('keeps run directories newer than retentionDays', () => {
    const recent = makeRun(TIDE_DIR, 'ptask2', 'new-run', new Date(Date.now() - 5 * 86400 * 1000).toISOString())
    pruneOldRuns(TIDE_DIR, 'ptask2', 30)
    assert.ok(fs.existsSync(recent))
  })

  test('is a no-op when runs directory does not exist', () => {
    assert.doesNotThrow(() => pruneOldRuns(TIDE_DIR, 'nonexistent-task', 30))
  })

  test('is a no-op when a run directory has no run.json', () => {
    const dir = path.join(TIDE_DIR, 'tasks', 'ptask3', 'runs', 'no-json-run')
    fs.mkdirSync(dir, { recursive: true })
    assert.doesNotThrow(() => pruneOldRuns(TIDE_DIR, 'ptask3', 30))
    assert.ok(fs.existsSync(dir))
  })

  test('uses startedAt to determine age', () => {
    const exactlyOnCutoff = makeRun(
      TIDE_DIR, 'ptask4', 'cutoff-run',
      new Date(Date.now() - 31 * 86400 * 1000).toISOString(),
    )
    const justUnder = makeRun(
      TIDE_DIR, 'ptask4', 'keep-run',
      new Date(Date.now() - 29 * 86400 * 1000).toISOString(),
    )
    pruneOldRuns(TIDE_DIR, 'ptask4', 30)
    assert.ok(!fs.existsSync(exactlyOnCutoff))
    assert.ok(fs.existsSync(justUnder))
  })
})
