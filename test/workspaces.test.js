import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'tide-test-workspaces-'))
process.env.HOME = TMP

const { readWorkspaces, addWorkspace, removeWorkspace, migrateSourceTxt } = await import('../src/lib/workspaces.js?bust=1')

const WORKSPACES_FILE = path.join(TMP, '.tide', 'workspaces.json')

function resetWorkspaces() {
  if (fs.existsSync(WORKSPACES_FILE)) fs.unlinkSync(WORKSPACES_FILE)
}

describe('readWorkspaces', () => {
  test('returns [] when file does not exist', () => {
    resetWorkspaces()
    assert.deepEqual(readWorkspaces(), [])
  })

  test('returns [] when file contains corrupt JSON', () => {
    fs.mkdirSync(path.join(TMP, '.tide'), { recursive: true })
    fs.writeFileSync(WORKSPACES_FILE, 'not json')
    assert.deepEqual(readWorkspaces(), [])
    resetWorkspaces()
  })

  test('returns parsed array when file is valid', () => {
    fs.mkdirSync(path.join(TMP, '.tide'), { recursive: true })
    fs.writeFileSync(WORKSPACES_FILE, JSON.stringify([{ path: '/some/repo' }]))
    assert.deepEqual(readWorkspaces(), [{ path: '/some/repo' }])
    resetWorkspaces()
  })
})

describe('addWorkspace', () => {
  test('creates workspaces.json on first call', () => {
    resetWorkspaces()
    addWorkspace('/repo/a')
    assert.deepEqual(readWorkspaces(), [{ path: '/repo/a' }])
  })

  test('is idempotent — does not duplicate entries', () => {
    resetWorkspaces()
    addWorkspace('/repo/a')
    addWorkspace('/repo/a')
    assert.deepEqual(readWorkspaces(), [{ path: '/repo/a' }])
  })

  test('appends a new distinct entry', () => {
    resetWorkspaces()
    addWorkspace('/repo/a')
    addWorkspace('/repo/b')
    assert.deepEqual(readWorkspaces(), [{ path: '/repo/a' }, { path: '/repo/b' }])
  })
})

describe('removeWorkspace', () => {
  test('removes the matching entry', () => {
    resetWorkspaces()
    addWorkspace('/repo/a')
    addWorkspace('/repo/b')
    removeWorkspace('/repo/a')
    assert.deepEqual(readWorkspaces(), [{ path: '/repo/b' }])
  })

  test('is a no-op when entry does not exist', () => {
    resetWorkspaces()
    addWorkspace('/repo/a')
    removeWorkspace('/repo/x')
    assert.deepEqual(readWorkspaces(), [{ path: '/repo/a' }])
  })
})

describe('migrateSourceTxt', () => {
  function makeSourceTxt(id, sourcePath) {
    const dir = path.join(TMP, '.tide', 'tasks', id)
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'source.txt'), sourcePath, 'utf8')
  }

  test('seeds workspaces.json from source.txt and deletes source.txt', () => {
    resetWorkspaces()
    // sourcePath = <repoRoot>/.tide/<name>.md → repoRoot is two levels up
    const repoRoot = path.join(TMP, 'myrepo')
    const sourcePath = path.join(repoRoot, '.tide', 'task.md')
    makeSourceTxt('abc123', sourcePath)

    migrateSourceTxt()

    assert.deepEqual(readWorkspaces(), [{ path: repoRoot }])
    assert.equal(fs.existsSync(path.join(TMP, '.tide', 'tasks', 'abc123', 'source.txt')), false)
  })

  test('is idempotent — second call is a no-op', () => {
    resetWorkspaces()
    migrateSourceTxt()
    assert.deepEqual(readWorkspaces(), [])
  })

  test('does not duplicate workspaces when run twice with same source', () => {
    resetWorkspaces()
    const repoRoot = path.join(TMP, 'duperepo')
    const sourcePath = path.join(repoRoot, '.tide', 'task.md')
    makeSourceTxt('id1', sourcePath)
    migrateSourceTxt()
    // Manually re-create source.txt to simulate a second run
    makeSourceTxt('id1', sourcePath)
    migrateSourceTxt()
    assert.deepEqual(readWorkspaces(), [{ path: repoRoot }])
  })

  test('logs a warning for non-ENOENT errors, does not throw', () => {
    resetWorkspaces()
    const taskDir = path.join(TMP, '.tide', 'tasks', 'badid')
    fs.mkdirSync(taskDir, { recursive: true })
    // Create source.txt as a directory so reading it as a file throws EISDIR
    const sourceTxtPath = path.join(taskDir, 'source.txt')
    fs.mkdirSync(sourceTxtPath, { recursive: true })

    const warnings = []
    const origError = console.error
    console.error = (...args) => warnings.push(args.join(' '))
    try {
      assert.doesNotThrow(() => migrateSourceTxt())
      assert.ok(warnings.some(w => w.includes('warning')), 'expected a warning to be logged')
    } finally {
      console.error = origError
      fs.rmSync(sourceTxtPath, { recursive: true })
    }
  })
})
