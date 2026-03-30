import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'tide-test-logs-'))
process.env.HOME = TMP

const { getOutputLog, getStderrLog, getStdoutLog } = await import('../src/lib/logs.js?bust=1')

const TASKS_DIR = path.join(TMP, '.tide', 'tasks')
const TASK_ID = 'log-task'
const LOGS_DIR = path.join(TASKS_DIR, TASK_ID, 'logs')

before(() => {
  fs.mkdirSync(LOGS_DIR, { recursive: true })
})

after(() => {
  fs.rmSync(TMP, { recursive: true, force: true })
})

describe('getOutputLog / getStdoutLog / getStderrLog', () => {
  test('returns null when file does not exist', () => {
    assert.equal(getOutputLog(TASK_ID), null)
    assert.equal(getStdoutLog(TASK_ID), null)
    assert.equal(getStderrLog(TASK_ID), null)
  })

  test('returns empty string for an empty file', () => {
    fs.writeFileSync(path.join(LOGS_DIR, 'output.log'), '')
    assert.equal(getOutputLog(TASK_ID), '')
  })

  test('returns full content when line count is within limit', () => {
    fs.writeFileSync(path.join(LOGS_DIR, 'stdout.log'), 'line1\nline2\nline3')
    assert.equal(getStdoutLog(TASK_ID, 10), 'line1\nline2\nline3')
  })

  test('returns last N lines', () => {
    const content = Array.from({ length: 10 }, (_, i) => `line${i + 1}`).join('\n')
    fs.writeFileSync(path.join(LOGS_DIR, 'stderr.log'), content)
    const result = getStderrLog(TASK_ID, 3)
    assert.equal(result, 'line8\nline9\nline10')
  })

  test('trailing newline is trimmed from line count', () => {
    fs.writeFileSync(path.join(LOGS_DIR, 'output.log'), 'a\nb\nc\n')
    assert.equal(getOutputLog(TASK_ID, 2), 'b\nc')
  })
})
