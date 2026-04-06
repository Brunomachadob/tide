import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'tide-test-logs-'))
process.env.HOME = TMP

const { getRunOutputLog, getRunStderrLog } = await import('../src/lib/logs.js?bust=1')

const TASKS_DIR = path.join(TMP, '.tide', 'tasks')
const TASK_ID = 'log-task'
const RUN_ID = 'abc12345'
const RUN_DIR = path.join(TASKS_DIR, TASK_ID, 'runs', RUN_ID)

before(() => {
  fs.mkdirSync(RUN_DIR, { recursive: true })
})

after(() => {
  fs.rmSync(TMP, { recursive: true, force: true })
})

describe('log readers', () => {
  test('returns null when file does not exist', () => {
    assert.equal(getRunOutputLog('nonexistent-task', 'no-run'), null)
    assert.equal(getRunStderrLog('nonexistent-task', 'no-run'), null)
  })

  test('returns empty string for an empty file', () => {
    fs.writeFileSync(path.join(RUN_DIR, 'output.log'), '')
    assert.equal(getRunOutputLog(TASK_ID, RUN_ID), '')
  })

  test('returns last N lines', () => {
    const content = Array.from({ length: 10 }, (_, i) => `line${i + 1}`).join('\n')
    fs.writeFileSync(path.join(RUN_DIR, 'stderr.log'), content)
    assert.equal(getRunStderrLog(TASK_ID, RUN_ID, 3), 'line8\nline9\nline10')
  })

  test('ignores trailing newline when counting lines', () => {
    fs.writeFileSync(path.join(RUN_DIR, 'output.log'), 'a\nb\nc\n')
    assert.equal(getRunOutputLog(TASK_ID, RUN_ID, 2), 'b\nc')
  })
})
