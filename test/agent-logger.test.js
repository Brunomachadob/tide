import { test, describe, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'tide-test-logger-'))

const { now, sleep, configureLogger, log, logError, rotateLog } =
  await import('../scripts/lib/agent-logger.js?bust=1')

beforeEach(() => {
  // Reset logger state before each test
  configureLogger({ outputLog: null, stderrLog: null, prefix: '' })
})

describe('now()', () => {
  test('returns a valid ISO timestamp without milliseconds', () => {
    const result = now()
    assert.match(result, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/)
  })

  test('does not contain a decimal point before Z', () => {
    assert.doesNotMatch(now(), /\.\d+Z$/)
  })
})

describe('sleep()', () => {
  test('resolves after at least the specified ms', async () => {
    const start = Date.now()
    await sleep(20)
    assert.ok(Date.now() - start >= 15)
  })
})

describe('rotateLog()', () => {
  test('is a no-op when the file does not exist', () => {
    assert.doesNotThrow(() => rotateLog(path.join(TMP, 'nonexistent.log')))
  })

  test('is a no-op when file is at or below 5 MB', () => {
    const file = path.join(TMP, 'small.log')
    const content = 'a'.repeat(100)
    fs.writeFileSync(file, content)
    rotateLog(file)
    assert.equal(fs.readFileSync(file, 'utf8'), content)
  })

  test('truncates to last 2 MB and prepends rotation marker when file exceeds 5 MB', () => {
    const file = path.join(TMP, 'large.log')
    const FIVE_MB = 5 * 1024 * 1024 + 1
    fs.writeFileSync(file, 'x'.repeat(FIVE_MB))
    rotateLog(file)
    const result = fs.readFileSync(file)
    assert.ok(result.length <= 2 * 1024 * 1024 + '[... rotated ...]\n'.length)
    assert.ok(result.toString('utf8').startsWith('[... rotated ...]'))
  })
})

describe('log() and logError()', () => {
  test('log() writes to stdout', () => {
    const lines = []
    const orig = process.stdout.write.bind(process.stdout)
    process.stdout.write = (data) => { lines.push(data); return true }
    try {
      configureLogger({ prefix: ' [test]' })
      log('hello')
    } finally {
      process.stdout.write = orig
    }
    assert.ok(lines.some(l => l.includes('hello')))
  })

  test('logError() writes to stdout', () => {
    const lines = []
    const orig = process.stdout.write.bind(process.stdout)
    process.stdout.write = (data) => { lines.push(data); return true }
    try {
      logError('something went wrong')
    } finally {
      process.stdout.write = orig
    }
    assert.ok(lines.some(l => l.includes('something went wrong')))
  })

  test('log() includes the configured prefix', () => {
    const lines = []
    const orig = process.stdout.write.bind(process.stdout)
    process.stdout.write = (data) => { lines.push(data); return true }
    try {
      configureLogger({ prefix: ' [my-task] [abc123]' })
      log('running')
    } finally {
      process.stdout.write = orig
    }
    assert.ok(lines.some(l => l.includes('[my-task] [abc123]')))
  })

  test('logError() includes the configured prefix', () => {
    const lines = []
    const orig = process.stdout.write.bind(process.stdout)
    process.stdout.write = (data) => { lines.push(data); return true }
    try {
      configureLogger({ prefix: ' [my-task]' })
      logError('error msg')
    } finally {
      process.stdout.write = orig
    }
    assert.ok(lines.some(l => l.includes('[my-task]') && l.includes('error msg')))
  })

  test('log() appends to outputLog when configured', () => {
    const logFile = path.join(TMP, 'output.log')
    configureLogger({ outputLog: logFile })
    log('written to file')
    const content = fs.readFileSync(logFile, 'utf8')
    assert.ok(content.includes('written to file'))
  })

  test('logError() appends to stderrLog when configured', () => {
    const logFile = path.join(TMP, 'stderr.log')
    configureLogger({ stderrLog: logFile })
    logError('error written to file')
    const content = fs.readFileSync(logFile, 'utf8')
    assert.ok(content.includes('error written to file'))
  })

  test('log() does not write to outputLog when not configured', () => {
    const logFile = path.join(TMP, 'not-created.log')
    configureLogger({ outputLog: null })
    log('should not appear')
    assert.ok(!fs.existsSync(logFile))
  })

  test('log() output format is [<timestamp>]<prefix> <msg>', () => {
    const lines = []
    const orig = process.stdout.write.bind(process.stdout)
    process.stdout.write = (data) => { lines.push(data); return true }
    try {
      configureLogger({ prefix: ' [pfx]' })
      log('the message')
    } finally {
      process.stdout.write = orig
    }
    const line = lines.find(l => l.includes('the message'))
    assert.ok(line)
    assert.match(line, /^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z\] \[pfx\] the message\n$/)
  })

  test('file write errors are silently swallowed', () => {
    configureLogger({ outputLog: '/nonexistent-dir/output.log' })
    assert.doesNotThrow(() => log('this will fail to write'))
  })
})
