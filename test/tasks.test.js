import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'tide-test-tasks-'))
process.env.HOME = TMP

// Cache-buster ensures this import gets its own module instance with the
// HOME we just set (the static import above already captured the real home).
const { readTask, readTasks, writeTask, resolveTask, resolveId, setEnabled, deleteTask, taskDir, taskFile } =
  await import('../src/lib/tasks.js?bust=1')

const TASKS_DIR = path.join(TMP, '.tide', 'tasks')

function makeTask(overrides = {}) {
  return {
    id: 'aabbccdd',
    name: 'My task',
    argument: 'Do something',
    command: 'claude',
    extraArgs: [],
    schedule: { type: 'interval', intervalSeconds: 3600 },
    createdAt: '2024-01-01T09:00:00Z',
    enabled: true,
    maxRetries: 0,
    workingDirectory: '/tmp',
    env: {},
    resultRetentionDays: 30,
    ...overrides,
  }
}

// ── taskDir / taskFile ─────────────────────────────────────────────────────

describe('taskDir / taskFile', () => {
  test('taskDir returns path under TASKS_DIR', () => {
    assert.equal(taskDir('abc'), path.join(TASKS_DIR, 'abc'))
  })

  test('taskFile returns task.json path', () => {
    assert.equal(taskFile('abc'), path.join(TASKS_DIR, 'abc', 'task.json'))
  })
})

// ── readTask ───────────────────────────────────────────────────────────────

describe('readTask', () => {
  before(() => {
    // write a valid task file
    const dir = path.join(TASKS_DIR, 'aabbccdd', 'logs')
    fs.mkdirSync(dir, { recursive: true })
    fs.mkdirSync(path.join(TASKS_DIR, 'aabbccdd', 'results'), { recursive: true })
    fs.writeFileSync(
      path.join(TASKS_DIR, 'aabbccdd', 'task.json'),
      JSON.stringify(makeTask())
    )
    // write a corrupt file
    const corruptDir = path.join(TASKS_DIR, 'corrupt', 'logs')
    fs.mkdirSync(corruptDir, { recursive: true })
    fs.writeFileSync(path.join(TASKS_DIR, 'corrupt', 'task.json'), 'not-json')
  })

  test('returns task when file exists and is valid', () => {
    const task = readTask('aabbccdd')
    assert.equal(task.id, 'aabbccdd')
    assert.equal(task.name, 'My task')
  })

  test('returns null when id does not exist', () => {
    assert.equal(readTask('nonexistent'), null)
  })

  test('returns null when file is corrupt JSON', () => {
    assert.equal(readTask('corrupt'), null)
  })
})

// ── readTasks ──────────────────────────────────────────────────────────────

describe('readTasks', () => {
  test('returns tasks sorted by createdAt', () => {
    const { tasks } = readTasks()
    assert.ok(Array.isArray(tasks))
    // aabbccdd should be in there
    assert.ok(tasks.some(t => t.id === 'aabbccdd'))
  })

  test('sorts by createdAt ascending', () => {
    const { tasks } = readTasks()
    for (let i = 1; i < tasks.length; i++) {
      assert.ok((tasks[i - 1].createdAt || '') <= (tasks[i].createdAt || ''))
    }
  })
})

// ── writeTask ──────────────────────────────────────────────────────────────

describe('writeTask', () => {
  test('writes and can be read back', () => {
    const task = makeTask({ id: 'writetest', name: 'Write Test' })
    fs.mkdirSync(path.join(TASKS_DIR, 'writetest', 'logs'), { recursive: true })
    fs.mkdirSync(path.join(TASKS_DIR, 'writetest', 'results'), { recursive: true })
    writeTask(task)
    const read = readTask('writetest')
    assert.equal(read.name, 'Write Test')
  })

  test('overwrites existing task', () => {
    const task = makeTask({ id: 'writetest', name: 'Updated Name' })
    writeTask(task)
    assert.equal(readTask('writetest').name, 'Updated Name')
  })
})

// ── resolveTask ────────────────────────────────────────────────────────────

describe('resolveTask', () => {
  test('resolves by exact id', () => {
    assert.equal(resolveTask('aabbccdd')?.id, 'aabbccdd')
  })

  test('resolves by id prefix', () => {
    assert.equal(resolveTask('aabb')?.id, 'aabbccdd')
  })

  test('resolves by name (case-insensitive)', () => {
    assert.equal(resolveTask('my task')?.id, 'aabbccdd')
  })

  test('returns null for unknown identifier', () => {
    assert.equal(resolveTask('zzzzzzz'), null)
  })
})

// ── resolveId ─────────────────────────────────────────────────────────────

describe('resolveId', () => {
  test('returns id string for known task', () => {
    assert.equal(resolveId('aabbccdd'), 'aabbccdd')
  })

  test('throws for unknown task', () => {
    assert.throws(() => resolveId('unknown'), /No task found/)
  })
})

// ── setEnabled ─────────────────────────────────────────────────────────────

describe('setEnabled', () => {
  test('disables a task', () => {
    setEnabled('aabbccdd', false)
    assert.equal(readTask('aabbccdd').enabled, false)
  })

  test('re-enables a task', () => {
    setEnabled('aabbccdd', true)
    assert.equal(readTask('aabbccdd').enabled, true)
  })

  test('throws for unknown id', () => {
    assert.throws(() => setEnabled('nope', true), /not found/)
  })
})

// ── deleteTask ─────────────────────────────────────────────────────────────

describe('deleteTask', () => {
  test('removes the task directory', () => {
    const task = makeTask({ id: 'todelete' })
    fs.mkdirSync(path.join(TASKS_DIR, 'todelete', 'logs'), { recursive: true })
    fs.mkdirSync(path.join(TASKS_DIR, 'todelete', 'results'), { recursive: true })
    writeTask(task)
    assert.ok(readTask('todelete'))
    deleteTask('todelete')
    assert.equal(readTask('todelete'), null)
  })

  test('is a no-op for a non-existent id', () => {
    assert.doesNotThrow(() => deleteTask('never-existed'))
  })
})

// ── cleanup ────────────────────────────────────────────────────────────────

after(() => {
  fs.rmSync(TMP, { recursive: true, force: true })
})
