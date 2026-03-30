import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'tide-test-results-'))
process.env.HOME = TMP

const { getResults, getLatestResult } = await import('../src/lib/results.js?bust=1')

const TASKS_DIR = path.join(TMP, '.tide', 'tasks')

function resultsDir(taskId) {
  return path.join(TASKS_DIR, taskId, 'results')
}

function writeResult(taskId, name, data) {
  fs.writeFileSync(path.join(resultsDir(taskId), name), JSON.stringify(data))
}

function setupTask(taskId) {
  fs.mkdirSync(resultsDir(taskId), { recursive: true })
}

after(() => {
  fs.rmSync(TMP, { recursive: true, force: true })
})

describe('getResults', () => {
  test('returns [] for unknown task', () => {
    assert.deepEqual(getResults('no-such-task'), [])
  })

  test('returns [] when results dir has no JSON files', () => {
    setupTask('empty-task')
    assert.deepEqual(getResults('empty-task'), [])
  })

  test('returns results most-recent-first', () => {
    setupTask('ordered-task')
    writeResult('ordered-task', '2024-01-01T08:00:00Z.json', { exitCode: 0, startedAt: '2024-01-01T08:00:00Z' })
    writeResult('ordered-task', '2024-01-02T08:00:00Z.json', { exitCode: 1, startedAt: '2024-01-02T08:00:00Z' })
    writeResult('ordered-task', '2024-01-03T08:00:00Z.json', { exitCode: 0, startedAt: '2024-01-03T08:00:00Z' })

    const results = getResults('ordered-task')
    assert.equal(results.length, 3)
    assert.equal(results[0].startedAt, '2024-01-03T08:00:00Z')
    assert.equal(results[1].startedAt, '2024-01-02T08:00:00Z')
    assert.equal(results[2].startedAt, '2024-01-01T08:00:00Z')
  })

  test('respects the count limit', () => {
    setupTask('limit-task')
    writeResult('limit-task', '2024-01-01T08:00:00Z.json', { startedAt: '2024-01-01T08:00:00Z' })
    writeResult('limit-task', '2024-01-02T08:00:00Z.json', { startedAt: '2024-01-02T08:00:00Z' })
    writeResult('limit-task', '2024-01-03T08:00:00Z.json', { startedAt: '2024-01-03T08:00:00Z' })

    const results = getResults('limit-task', 2)
    assert.equal(results.length, 2)
    assert.equal(results[0].startedAt, '2024-01-03T08:00:00Z')
  })

  test('handles corrupt JSON files gracefully', () => {
    setupTask('corrupt-task')
    writeResult('corrupt-task', '2024-01-01T08:00:00Z.json', { exitCode: 0 })
    fs.writeFileSync(path.join(resultsDir('corrupt-task'), '2024-01-02T08:00:00Z.json'), 'not-json')

    const results = getResults('corrupt-task', 10)
    const corrupt = results.find(r => r.error)
    assert.ok(corrupt, 'corrupt entry should surface an error field')
  })
})

describe('getLatestResult', () => {
  before(() => {
    setupTask('latest-task')
    writeResult('latest-task', '2024-01-01T08:00:00Z.json', { exitCode: 0, startedAt: '2024-01-01T08:00:00Z' })
    writeResult('latest-task', '2024-01-02T08:00:00Z.json', { exitCode: 1, startedAt: '2024-01-02T08:00:00Z' })
  })

  test('returns the single most recent result', () => {
    const latest = getLatestResult('latest-task')
    assert.equal(latest?.startedAt, '2024-01-02T08:00:00Z')
  })

  test('returns null when task has no results', () => {
    assert.equal(getLatestResult('no-such-task'), null)
  })
})
