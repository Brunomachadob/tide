// Repo-based markdown task file support.
// Discovers .tide/*.md files in a git repo, computes pending sync operations,
// and applies them to ~/.tide/tasks/<id>/task.json + launchd.
import fs from 'fs'
import path from 'path'
import os from 'os'
import crypto from 'crypto'
import matter from 'gray-matter'
import { readTask, readTasks, writeTask, deleteTask, taskDir } from './tasks.js'
import { writePlist } from './create.js'
import { bootstrap, bootout, plistPath } from './launchd.js'
import { readSettings } from './settings.js'

const SCHEDULE_SHORTHANDS = {
  manual: null,
  '15m':  15 * 60,
  '30m':  30 * 60,
  '1h':   60 * 60,
  '2h':   2  * 60 * 60,
  '6h':   6  * 60 * 60,
  '12h':  12 * 60 * 60,
  '24h':  24 * 60 * 60,
}

// Fields we diff for change detection (excludes stable fields like createdAt, jitterSeconds)
const DIFFABLE_FIELDS = [
  'name', 'argument', 'command', 'schedule', 'workingDirectory',
  'maxRetries', 'claudeStreamJson', 'enabled', 'resultRetentionDays',
  'env', 'extraArgs', 'timeoutSeconds',
]

/** Returns startDir if it contains a .tide/ folder, otherwise null. */
export function findRepoRoot(startDir) {
  const dir = path.resolve(startDir)
  return fs.existsSync(path.join(dir, '.tide')) ? dir : null
}

/** Return all .md file paths in <repoRoot>/.tide/ */
export function discoverTaskFiles(repoRoot) {
  const tideDir = path.join(repoRoot, '.tide')
  if (!fs.existsSync(tideDir)) return []
  return fs.readdirSync(tideDir)
    .filter(f => f.endsWith('.md'))
    .map(f => path.join(tideDir, f))
}

/** Parse schedule shorthand string into { type, intervalSeconds } */
function parseSchedule(value) {
  if (!value || value === 'manual') return { type: 'manual' }
  const seconds = SCHEDULE_SHORTHANDS[String(value)]
  if (seconds == null) {
    // Try raw number (seconds)
    const n = parseInt(value)
    if (!isNaN(n) && n > 0) return { type: 'interval', intervalSeconds: n }
    return { type: 'manual' }
  }
  return { type: 'interval', intervalSeconds: seconds }
}

/**
 * Parse a .md task file. Returns a task-shaped object with all defaults applied,
 * plus an `_explicitFields` Set of frontmatter keys that were explicitly present.
 * Only explicit fields are used in diffFields — defaults are not diffed.
 * Does NOT write the id back — call ensureTaskId first if needed.
 */
export function parseTaskFile(filePath) {
  const settings = readSettings()
  const raw = fs.readFileSync(filePath, 'utf8')
  const { data: fm, content: body } = matter(raw)

  // Track which fields were explicitly set in frontmatter
  const _explicitFields = new Set(Object.keys(fm))
  // argument (body) is always explicit
  _explicitFields.add('argument')

  const schedule = parseSchedule(fm.schedule)

  return {
    id: fm.id || null,
    name: fm.name || path.basename(filePath, '.md'),
    argument: body.trim(),
    command: fm.command || settings.command || '',
    extraArgs: fm.extraArgs || [],
    schedule,
    workingDirectory: fm.workingDirectory
      ? fm.workingDirectory.replace(/^~/, os.homedir())
      : (settings.defaultWorkingDirectory || os.homedir()),
    maxRetries: fm.maxRetries ?? 0,
    env: fm.env || {},
    resultRetentionDays: fm.resultRetentionDays ?? 30,
    claudeStreamJson: fm.claudeStreamJson ?? false,
    timeoutSeconds: fm.timeoutSeconds ?? null,
    enabled: fm.enabled ?? true,
    sourcePath: filePath,
    _explicitFields,
  }
}

/**
 * If the file has no `id` in its frontmatter, generate one and write it back.
 * Returns the id (existing or newly generated).
 */
export function ensureTaskId(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8')
  const { data: fm } = matter(raw)
  if (fm.id) return fm.id

  const id = crypto.randomBytes(4).toString('hex')

  // Insert `id:` as the first line of the frontmatter block
  // raw starts with "---\n..." — insert after the opening "---"
  const updated = raw.replace(/^---\n/, `---\nid: ${id}\n`)
  const tmp = filePath + '.tmp'
  fs.writeFileSync(tmp, updated)
  fs.renameSync(tmp, filePath)

  return id
}

/** Compare two values for equality, handling objects/arrays via JSON. */
function valuesEqual(a, b) {
  if (a === b) return true
  if (typeof a !== typeof b) return false
  if (a == null || b == null) return a === b
  // Schedule: compare type + intervalSeconds
  if (typeof a === 'object') return JSON.stringify(a) === JSON.stringify(b)
  return a === b
}

/**
 * Compute changed fields between a parsed .md task and an existing task.json.
 * Only diffs fields that were explicitly present in the frontmatter — fields
 * that were omitted (falling back to defaults) are not considered changes.
 * Returns array of { field, from, to }.
 */
export function diffFields(parsed, existing) {
  const diffs = []
  for (const field of DIFFABLE_FIELDS) {
    // Skip fields not explicitly set in the frontmatter
    if (parsed._explicitFields && !parsed._explicitFields.has(field)) continue
    const parsedVal = parsed[field] ?? null
    const existingVal = existing[field] ?? null
    if (!valuesEqual(parsedVal, existingVal)) {
      diffs.push({ field, from: existingVal, to: parsedVal })
    }
  }
  return diffs
}

/**
 * Compute pending sync operations for all .md files under repoRoot, plus global orphan detection.
 * Returns {
 *   pending: [{ type: 'create'|'update'|'orphan', task, existing?, diff }],
 *   sourcePathMap: { [id]: filePath }  — all discovered .md files, including in-sync ones
 * }
 */
export function computePending(repoRoot) {
  const pending = []
  const seenIds = new Set()
  const sourcePathMap = {}  // id → filePath for ALL discovered .md files

  if (repoRoot) {
    const mdFiles = discoverTaskFiles(repoRoot)
    for (const filePath of mdFiles) {
      try {
        const id = ensureTaskId(filePath)
        seenIds.add(id)
        sourcePathMap[id] = filePath
        const parsed = parseTaskFile(filePath)
        parsed.id = id
        const existing = readTask(id)

        if (!existing) {
          pending.push({ type: 'create', task: parsed, diff: [] })
        } else {
          const diff = diffFields(parsed, existing)
          if (diff.length > 0) {
            pending.push({ type: 'update', task: parsed, existing, diff })
          }
        }
      } catch {
        // Skip unreadable/invalid files silently
      }
    }
  }

  // Global orphan detection: any task with a sourcePath whose file no longer exists
  try {
    const { tasks } = readTasks()
    for (const task of tasks) {
      if (task.sourcePath && !fs.existsSync(task.sourcePath)) {
        pending.push({ type: 'orphan', task, diff: [] })
      }
    }
  } catch {
    // readTasks failure is non-fatal
  }

  return { pending, sourcePathMap }
}

function computeJitter(schedule) {
  if (!schedule || schedule.type === 'manual') return 0
  const secs = schedule.intervalSeconds || 3600
  return Math.floor(Math.random() * Math.min(secs / 4, 300))
}

/**
 * Apply a single pending entry to disk + launchd.
 * For create/update: writes task.json + plist + bootstrap/bootout.
 * For orphan: bootout + delete plist + deleteTask.
 */
export function applyPending(entry) {
  if (entry.type === 'create' || entry.type === 'update') {
    const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z')
    const task = {
      ...entry.task,
      createdAt: entry.existing?.createdAt || now,
      jitterSeconds: entry.existing?.jitterSeconds ?? computeJitter(entry.task.schedule),
    }
    // Ensure task dir exists
    fs.mkdirSync(path.join(taskDir(task.id), 'logs'), { recursive: true })
    fs.mkdirSync(path.join(taskDir(task.id), 'runs'), { recursive: true })
    writeTask(task)
    writePlist(task.id, task)
    if (task.enabled) {
      bootstrap(task.id)
    } else {
      bootout(task.id)
    }
    return task
  }

  if (entry.type === 'orphan') {
    const { id } = entry.task
    bootout(id)
    const plist = plistPath(id)
    if (fs.existsSync(plist)) fs.unlinkSync(plist)
    deleteTask(id)
  }
}
