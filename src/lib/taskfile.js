// Repo-based markdown task file support.
// Discovers .tide/*.md files in a git repo, computes pending sync operations,
// and applies them to launchd plists directly (Phase 2 — no task.json).
import fs from 'fs'
import path from 'path'
import os from 'os'
import crypto from 'crypto'
import matter from 'gray-matter'
import { writePlist } from './create.js'
import { bootstrap, bootout, plistPath, readPlistJson, tideTaskFileFromPlist, scanTidePlists } from './launchd.js'
import { taskDir, deleteTask } from './tasks.js'
import { parseMdFile, writeTideFields } from './mdfields.js'
import { readWorkspaces, addWorkspace, migrateSourceTxt } from './workspaces.js'

// Fields that require a plist rewrite when changed
const PLIST_DIFFABLE_FIELDS = ['schedule', 'workingDirectory', 'env', 'timeoutSeconds']

// System env keys injected by Tide — excluded when extracting user env from plist
const SYSTEM_ENV_KEYS = new Set(['TIDE_TASK_ID', 'TIDE_TASK_FILE', 'TIDE_AGENT', 'TIDE_JITTER', 'TIDE_CREATED_AT', 'HOME', 'PATH'])

/** Walk up from startDir looking for a .tide/ directory. Stops at .git roots. Returns the dir containing .tide/ or null. */
export function findRepoRoot(startDir) {
  let dir = path.resolve(startDir)
  while (true) {
    if (fs.existsSync(path.join(dir, '.tide'))) return dir
    // Stop walking if we've hit a git root (don't escape the repo)
    if (fs.existsSync(path.join(dir, '.git'))) return null
    const parent = path.dirname(dir)
    if (parent === dir) return null  // filesystem root
    dir = parent
  }
}

/** Return all .md file paths in <repoRoot>/.tide/ */
export function discoverTaskFiles(repoRoot) {
  const tideDir = path.join(repoRoot, '.tide')
  if (!fs.existsSync(tideDir)) return []
  return fs.readdirSync(tideDir)
    .filter(f => f.endsWith('.md'))
    .map(f => path.join(tideDir, f))
}

/**
 * Parse a .md task file. Returns a task-shaped object with all defaults applied.
 * Reads _* keys for internal fields (id, createdAt, jitterSeconds, enabled).
 * _explicitFields tracks user-authored frontmatter keys (_* internals excluded).
 */
export function parseTaskFile(filePath) {
  return parseMdFile(filePath, { includeExplicitFields: true })
}

/**
 * If the file has no _id, generate one and write it back.
 * Returns the id.
 */
export function ensureTaskId(filePath) {
  const { data: fm } = matter(fs.readFileSync(filePath, 'utf8'))
  const existing = fm['_id']
  if (existing) return existing

  const id = crypto.randomBytes(4).toString('hex')
  writeTideFields(filePath, { '_id': id })
  return id
}

/** Compare two values for equality, handling objects/arrays via JSON. */
function valuesEqual(a, b) {
  if (a === b) return true
  if (typeof a !== typeof b) return false
  if (a == null || b == null) return a === b
  if (typeof a === 'object') return JSON.stringify(a) === JSON.stringify(b)
  return a === b
}

/**
 * Extract a task-shaped object from a plist JSON for diffing purposes.
 * Only covers PLIST_DIFFABLE_FIELDS.
 */
function plistToTaskShape(plistJson) {
  const startInterval = plistJson.StartInterval
  const schedule = startInterval
    ? { type: 'interval', intervalSeconds: startInterval }
    : { type: 'manual' }

  const workingDirectory = plistJson.WorkingDirectory || os.homedir()

  const envVars = plistJson.EnvironmentVariables || {}
  const env = Object.fromEntries(
    Object.entries(envVars).filter(([k]) => !SYSTEM_ENV_KEYS.has(k))
  )

  const jitterSeconds = parseInt(envVars.TIDE_JITTER ?? '0') || 0
  const timeOut = plistJson.TimeOut ?? null
  const timeoutSeconds = timeOut !== null ? timeOut - jitterSeconds : null

  return { schedule, workingDirectory, env, enabled: true, timeoutSeconds, jitterSeconds }
}

/**
 * Diff parsed .md task against plist-derived shape.
 * Only diffs PLIST_DIFFABLE_FIELDS that were explicitly set in frontmatter.
 * `enabled` is intentionally excluded — it is checked in useTasks where launchd
 * status is already available, avoiding a redundant subprocess call per task.
 */
function diffPlistFields(parsed, plistShape) {
  const diffs = []
  for (const field of PLIST_DIFFABLE_FIELDS) {
    if (field === 'enabled') continue
    if (parsed._explicitFields && !parsed._explicitFields.has(field)) continue
    const parsedVal = parsed[field] ?? null
    const plistVal = plistShape[field] ?? null
    if (!valuesEqual(parsedVal, plistVal)) {
      diffs.push({ field, from: plistVal, to: parsedVal })
    }
  }
  return diffs
}

/**
 * Compute pending sync operations for all .md files under repoRoot, plus global orphan detection.
 */
export function computePending(repoRoot) {
  const pending = []
  const seenIds = new Set()
  const sourcePathMap = {}

  const allPlists = scanTidePlists()
  // Build map: tideTaskFile → { id, plistFile, plistJson }
  const plistByMd = {}
  for (const entry of allPlists) {
    if (entry.tideTaskFile) {
      plistByMd[entry.tideTaskFile] = entry
    }
  }

  // Collect all .tide/ roots to scan for pending creates/updates:
  // - the current repoRoot (from cwd)
  // - all roots inferred from existing plist TIDE_TASK_FILE paths
  // - roots recovered from source.txt in ~/.tide/tasks/<id>/ (survives plist deletion)
  const tideRoots = new Set()
  if (repoRoot) tideRoots.add(repoRoot)
  for (const entry of allPlists) {
    if (entry.tideTaskFile) {
      // TIDE_TASK_FILE is <root>/.tide/<name>.md — root is two levels up
      tideRoots.add(path.dirname(path.dirname(entry.tideTaskFile)))
    }
  }
  migrateSourceTxt()
  for (const ws of readWorkspaces()) {
    if (ws.path) tideRoots.add(ws.path)
  }

  for (const root of tideRoots) {
    const mdFiles = discoverTaskFiles(root)
    for (const filePath of mdFiles) {
      try {
        const id = ensureTaskId(filePath)
        seenIds.add(id)
        sourcePathMap[id] = filePath
        const parsed = parseTaskFile(filePath)
        parsed.id = id

        const plistEntry = plistByMd[filePath]
        if (!plistEntry) {
          pending.push({ type: 'create', task: parsed, diff: [] })
        } else {
          const plistShape = plistEntry.plistJson ? plistToTaskShape(plistEntry.plistJson) : null
          const diff = plistShape ? diffPlistFields(parsed, plistShape) : []
          if (diff.length > 0) {
            pending.push({ type: 'update', task: parsed, existing: plistShape, diff })
          }
        }
      } catch {
        // Skip unreadable/invalid files silently
      }
    }
  }

  // Global orphan detection: any plist whose TIDE_TASK_FILE no longer exists
  for (const entry of allPlists) {
    if (entry.tideTaskFile && !fs.existsSync(entry.tideTaskFile)) {
      pending.push({
        type: 'orphan',
        task: { id: entry.id, sourcePath: entry.tideTaskFile },
        diff: [],
      })
    }
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
 * For create/update: writes underscore-prefixed internal fields to .md + plist + bootstrap/bootout.
 * For orphan: bootout + delete plist + deleteTask.
 */
export function applyPending(entry) {
  if (entry.type === 'create' || entry.type === 'update') {
    const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z')
    const sourcePath = entry.task.sourcePath
    const parsed = sourcePath ? parseTaskFile(sourcePath) : entry.task
    parsed.id = entry.task.id

    // For updates: preserve existing jitter and createdAt from the current plist env vars.
    // For creates: compute fresh jitter and use now as createdAt.
    let jitterSeconds, createdAt
    if (entry.type === 'update') {
      const existingPlistJson = (() => { try { return readPlistJson(plistPath(parsed.id)) } catch { return null } })()
      const existingEnv = existingPlistJson?.EnvironmentVariables || {}
      jitterSeconds = parseInt(existingEnv.TIDE_JITTER ?? '') || computeJitter(parsed.schedule)
      createdAt = existingEnv.TIDE_CREATED_AT || now
    } else {
      jitterSeconds = computeJitter(parsed.schedule)
      createdAt = now
    }

    // Write _id back to .md (only internal field that stays in the file)
    writeTideFields(sourcePath, { '_id': parsed.id })

    const task = {
      ...parsed,
      createdAt,
      jitterSeconds,
    }

    // Ensure task dir exists (for run history)
    const tDir = taskDir(task.id)
    fs.mkdirSync(path.join(tDir, 'logs'), { recursive: true })
    fs.mkdirSync(path.join(tDir, 'runs'), { recursive: true })
    if (sourcePath) {
      addWorkspace(path.dirname(path.dirname(sourcePath)))
    }

    writePlist(task.id, { ...task, enabled: true })
    bootstrap(task.id)
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
