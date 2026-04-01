#!/usr/bin/env node
// migrate-to-phase2.js — one-off migration from Phase 1 to Phase 2.
// Reads each ~/.tide/tasks/*/task.json, finds the source .md via sourcePath,
// and writes _id, _createdAt, _jitter, _enabled into the frontmatter.
//
// Usage:
//   node scripts/migrate-to-phase2.js
import fs from 'fs'
import os from 'os'
import path from 'path'
import matter from 'gray-matter'

const TIDE_DIR = path.join(os.homedir(), '.tide')
const TASKS_DIR = path.join(TIDE_DIR, 'tasks')

function injectTideFields(mdPath, fields) {
  const raw = fs.readFileSync(mdPath, 'utf8')
  const { data: fm, content } = matter(raw)

  // Merge tide: fields (overwrite any existing)
  for (const [k, v] of Object.entries(fields)) {
    fm[k] = v
  }

  const updated = matter.stringify(content, fm)
  const tmp = mdPath + '.tmp'
  fs.writeFileSync(tmp, updated)
  fs.renameSync(tmp, mdPath)
}

if (!fs.existsSync(TASKS_DIR)) {
  console.log('No tasks directory found — nothing to migrate.')
  process.exit(0)
}

const ids = fs.readdirSync(TASKS_DIR)
let migrated = 0
let skipped = 0

for (const id of ids) {
  const taskFile = path.join(TASKS_DIR, id, 'task.json')
  if (!fs.existsSync(taskFile)) continue

  let task
  try {
    task = JSON.parse(fs.readFileSync(taskFile, 'utf8'))
  } catch {
    console.warn(`  SKIP ${id}: could not parse task.json`)
    skipped++
    continue
  }

  if (!task.sourcePath) {
    console.warn(`  SKIP ${id} (${task.name || 'unnamed'}): no sourcePath — manually created task, handle manually`)
    skipped++
    continue
  }

  if (!fs.existsSync(task.sourcePath)) {
    console.warn(`  SKIP ${id} (${task.name || 'unnamed'}): sourcePath not found: ${task.sourcePath}`)
    skipped++
    continue
  }

  try {
    injectTideFields(task.sourcePath, {
      '_id': task.id,
      '_createdAt': task.createdAt,
      '_jitter': task.jitterSeconds ?? 0,
      '_enabled': task.enabled ?? true,
    })
    console.log(`  OK  ${id} (${task.name || 'unnamed'}) → ${task.sourcePath}`)
    migrated++
  } catch (err) {
    console.warn(`  FAIL ${id}: ${err.message}`)
    skipped++
  }
}

console.log(`\nDone: ${migrated} migrated, ${skipped} skipped.`)
if (skipped > 0) {
  console.log('Skipped tasks still use task.json — they will continue to work until manually updated.')
}
