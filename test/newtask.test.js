import { test, describe, before } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'tide-test-newtask-'))
process.env.HOME = TMP

const REPO = path.join(TMP, 'repo')
const TIDE_DIR = path.join(REPO, '.tide')

// Fake editor: rewrites the name field in the file then exits
function setFakeEditor(name) {
  const script = path.join(TMP, 'fake-editor.sh')
  fs.writeFileSync(script, `#!/bin/sh\nnode -e "
const fs = require('fs')
const raw = fs.readFileSync(process.argv[1], 'utf8')
fs.writeFileSync(process.argv[1], raw.replace(/^name:.*$/m, 'name: ${name}'))
" "$1"\n`)
  fs.chmodSync(script, 0o755)
  process.env.EDITOR = script
}

before(() => {
  fs.mkdirSync(TIDE_DIR, { recursive: true })
})

describe('openNewTaskFile', () => {
  test('names the file from the name set in the editor', async () => {
    setFakeEditor('Daily Standup')
    const { openNewTaskFile } = await import('../src/lib/newtask.js?bust=1')
    openNewTaskFile(REPO)
    const files = fs.readdirSync(TIDE_DIR).filter(f => f.endsWith('.md'))
    assert.ok(files.includes('daily-standup.md'))
  })

  test('appends -2, -3 when slug already exists', async () => {
    setFakeEditor('Daily Standup')
    const { openNewTaskFile } = await import('../src/lib/newtask.js?bust=2')
    openNewTaskFile(REPO)
    openNewTaskFile(REPO)
    const files = fs.readdirSync(TIDE_DIR).filter(f => f.endsWith('.md')).sort()
    assert.ok(files.includes('daily-standup-2.md'))
    assert.ok(files.includes('daily-standup-3.md'))
  })

  test('falls back to "task.md" if name is empty', async () => {
    setFakeEditor('')
    const { openNewTaskFile } = await import('../src/lib/newtask.js?bust=3')
    openNewTaskFile(REPO)
    const files = fs.readdirSync(TIDE_DIR).filter(f => f.endsWith('.md'))
    assert.ok(files.some(f => f === 'task.md' || f.startsWith('task-')))
  })

  test('created file contains the saved content', async () => {
    setFakeEditor('My Report')
    const { openNewTaskFile } = await import('../src/lib/newtask.js?bust=4')
    openNewTaskFile(REPO)
    const content = fs.readFileSync(path.join(TIDE_DIR, 'my-report.md'), 'utf8')
    assert.ok(content.includes('name: My Report'))
    assert.ok(content.includes('schedule:'))
  })
})
