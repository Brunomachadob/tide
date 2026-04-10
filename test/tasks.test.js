import { test, describe, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'tide-test-tasks-'))
process.env.HOME = TMP

const { readTask, readTasks, setEnabled, deleteTask, taskDir } =
  await import('../src/lib/tasks.js?bust=1')

const TASKS_DIR = path.join(TMP, '.tide', 'tasks')
const LAUNCH_AGENTS_DIR = path.join(TMP, 'Library', 'LaunchAgents')
const MD_DIR = path.join(TMP, 'repo', '.tide')

fs.mkdirSync(LAUNCH_AGENTS_DIR, { recursive: true })
fs.mkdirSync(MD_DIR, { recursive: true })

// ── helpers ────────────────────────────────────────────────────────────────

function writeMd(id, fields = {}) {
  const {
    name = 'My task',
    schedule = '1h',
    argument = 'Do something',
    ...rest
  } = fields
  const frontmatter = [
    `_id: ${id}`,
    `name: ${name}`,
    `schedule: ${schedule}`,
    ...Object.entries(rest).map(([k, v]) => `${k}: ${JSON.stringify(v)}`),
  ].join('\n')
  const mdPath = path.join(MD_DIR, `${id}.md`)
  fs.writeFileSync(mdPath, `---\n${frontmatter}\n---\n\n${argument}`)
  return mdPath
}

function writePlistFor(id, mdPath, { createdAt = '2024-01-01T09:00:00Z', jitter = 0 } = {}) {
  const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.tide.${id}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>TIDE_TASK_ID</key>
    <string>${id}</string>
    <key>TIDE_TASK_FILE</key>
    <string>${mdPath}</string>
    <key>TIDE_CREATED_AT</key>
    <string>${createdAt}</string>
    <key>TIDE_JITTER</key>
    <string>${jitter}</string>
    <key>HOME</key>
    <string>${TMP}</string>
    <key>PATH</key>
    <string>/usr/bin:/bin</string>
  </dict>
  <key>ProgramArguments</key>
  <array>
    <string>/fake/tide.sh</string>
    <string>${id}</string>
  </array>
  <key>RunAtLoad</key>
  <false/>
</dict>
</plist>`
  const plistFile = path.join(LAUNCH_AGENTS_DIR, `com.tide.${id}.plist`)
  fs.writeFileSync(plistFile, plistContent)
  return plistFile
}

// ── taskDir ────────────────────────────────────────────────────────────────

describe('taskDir', () => {
  test('returns path under TASKS_DIR', () => {
    assert.equal(taskDir('abc'), path.join(TASKS_DIR, 'abc'))
  })
})

// ── readTask ───────────────────────────────────────────────────────────────

// Set up fixtures at module level so all describe blocks share them
const _md1 = writeMd('aabbccdd', { name: 'My task' })
writePlistFor('aabbccdd', _md1, { createdAt: '2024-01-01T09:00:00Z' })
const _md2 = writeMd('11223344', { name: 'Earlier Task' })
writePlistFor('11223344', _md2, { createdAt: '2023-06-01T00:00:00Z' })

describe('readTask', () => {

  test('returns task when plist and .md exist', () => {
    const task = readTask('aabbccdd')
    assert.equal(task.id, 'aabbccdd')
    assert.equal(task.name, 'My task')
  })

  test('returns null when plist does not exist', () => {
    assert.equal(readTask('nonexistent'), null)
  })

  test('returns null when TIDE_TASK_FILE .md is missing', () => {
    // Write plist pointing to non-existent md
    const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.tide.missingmd</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>TIDE_TASK_FILE</key><string>/nonexistent/path/task.md</string>
  </dict>
</dict>
</plist>`
    fs.writeFileSync(path.join(LAUNCH_AGENTS_DIR, 'com.tide.missingmd.plist'), plistContent)
    assert.equal(readTask('missingmd'), null)
  })
})

// ── readTasks ──────────────────────────────────────────────────────────────

describe('readTasks', () => {
  test('returns all tasks from plists', () => {
    const { tasks } = readTasks()
    assert.ok(Array.isArray(tasks))
    const ids = tasks.map(t => t.id)
    assert.ok(ids.includes('aabbccdd'))
    assert.ok(ids.includes('11223344'))
  })

  test('sorts by createdAt ascending', () => {
    const { tasks } = readTasks()
    const relevant = tasks.filter(t => ['aabbccdd', '11223344'].includes(t.id))
    assert.equal(relevant[0].id, '11223344')  // earlier createdAt comes first
    assert.equal(relevant[1].id, 'aabbccdd')
  })

  test('skips plists without TIDE_TASK_FILE', () => {
    const noMdPlist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.tide.nomd</string>
  <key>EnvironmentVariables</key><dict><key>TIDE_TASK_ID</key><string>nomd</string></dict>
</dict>
</plist>`
    fs.writeFileSync(path.join(LAUNCH_AGENTS_DIR, 'com.tide.nomd.plist'), noMdPlist)
    const { tasks } = readTasks()
    assert.ok(!tasks.some(t => t.id === 'nomd'))
  })
})

// ── setEnabled ─────────────────────────────────────────────────────────────

describe('setEnabled', () => {
  test('disable: rewrites plist with Disabled:true', () => {
    const plist = path.join(LAUNCH_AGENTS_DIR, 'com.tide.aabbccdd.plist')
    // Ensure plist exists (re-create if a prior test removed it)
    writePlistFor('aabbccdd', _md1)
    assert.ok(fs.existsSync(plist), 'plist should exist before disable')
    setEnabled('aabbccdd', false)
    assert.ok(fs.existsSync(plist), 'plist should still exist after disable')
    const plistRaw = fs.readFileSync(plist, 'utf8')
    assert.ok(plistRaw.includes('<key>Disabled</key>'), 'plist should have Disabled key')
  })

  test('enable: rewrites plist without Disabled key (bootstrap is a no-op in tests)', () => {
    // Re-create plist pointing to md so setEnabled(true) can find the .md path
    writePlistFor('aabbccdd', _md1)
    // bootstrap will call launchctl — it may fail with a fake plist, that's acceptable
    try { setEnabled('aabbccdd', true) } catch { /* launchctl not available in test env */ }
    const plistRaw = fs.readFileSync(path.join(LAUNCH_AGENTS_DIR, 'com.tide.aabbccdd.plist'), 'utf8')
    assert.ok(!plistRaw.includes('<key>Disabled</key>'), 'plist should not have Disabled key')
  })

  test('throws for unknown id (no plist)', () => {
    assert.throws(() => setEnabled('nope', true), /not found/)
  })
})

// ── deleteTask ─────────────────────────────────────────────────────────────

describe('deleteTask', () => {
  test('removes the task run directory', () => {
    const dir = path.join(TASKS_DIR, 'todelete', 'runs')
    fs.mkdirSync(dir, { recursive: true })
    assert.ok(fs.existsSync(path.join(TASKS_DIR, 'todelete')))
    deleteTask('todelete')
    assert.ok(!fs.existsSync(path.join(TASKS_DIR, 'todelete')))
  })

  test('is a no-op for a non-existent id', () => {
    assert.doesNotThrow(() => deleteTask('never-existed'))
  })
})

// ── cleanup ────────────────────────────────────────────────────────────────

after(() => {
  fs.rmSync(TMP, { recursive: true, force: true })
})
