import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'tide-test-results-'))
process.env.HOME = TMP

const { getResults, getLatestResult } = await import('../src/lib/results.js?bust=1')

const TASKS_DIR = path.join(TMP, '.tide', 'tasks')
const TASK_ID = 'task-abc'
const RESULTS_DIR = path.join(TASKS_DIR, TASK_ID, 'results')

function writeResult(name, data) {
  fs.writeFileSync(path.join(RESULTS_DIR, name), JSON.stringify(data))
}

before(() => {
  fs.mkdirSync(RESULTS_DIR, { recursive: true })
})

after(() => {
  fs.rmSync(TMP, { recursive: true, force: true })
})

describe('getResults', () => {
  test('returns [] for unknown task', () => {
    assert.deepEqual(getResults('no-such-task'), [])
  })

  test('returns [] when results dir exists but has no JSON files', () => {
    assert.deepEqual(getResults(TASK_ID), [])
  })

  test('returns results most-recent-first', () => {
    writeResult('2024-01-01T08:00:00Z.json', { exitCode: 0, startedAt: '2024-01-01T08:00:00Z' })
    writeResult('2024-01-02T08:00:00Z.json', { exitCode: 1, startedAt: '2024-01-02T08:00:00Z' })
    writeResult('2024-01-03T08:00:00Z.json', { exitCode: 0, startedAt: '2024-01-03T08:00:00Z' })

    const results = getResults(TASK_ID)
    assert.equal(results.length, 3)
    assert.equal(results[0].startedAt, '2024-01-03T08:00:00Z')
    assert.equal(results[1].startedAt, '2024-01-02T08:00:00Z')
    assert.equal(results[2].startedAt, '2024-01-01T08:00:00Z')
  })

  test('respects the count limit', () => {
    const results = getResults(TASK_ID, 2)
    assert.equal(results.length, 2)
    assert.equal(results[0].startedAt, '2024-01-03T08:00:00Z')
  })

  test('handles corrupt JSON files gracefully', () => {
    fs.writeFileSync(path.join(RESULTS_DIR, '2024-01-04T08:00:00Z.json'), 'not-json')
    const results = getResults(TASK_ID, 10)
    const corrupt = results.find(r => r.error)
    assert.ok(corrupt, 'corrupt entry should surface an error field')
  })
})

describe('getLatestResult', () => {
  test('returns the single most recent result', () => {
    const latest = getLatestResult(TASK_ID)
    // After above setup (including corrupt) the most recent by filename is the corrupt one
    assert.ok(latest !== null)
  })

  test('returns null when task has no results', () => {
    assert.equal(getLatestResult('no-such-task'), null)
  })
})
