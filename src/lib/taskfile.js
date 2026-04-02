// Repo-based markdown task file support.
// Discovers .tide/*.md files in a git repo, computes pending sync operations,
// and applies them to launchd plists directly (Phase 2 — no task.json).
import fs from 'fs'
import path from 'path'
import os from 'os'
import crypto from 'crypto'
import { spawnSync } from 'child_process'
import matter from 'gray-matter'
import { writePlist } from './create.js'
import { bootstrap, bootout, plistPath, label } from './launchd.js'
import { readSettings } from './settings.js'
import { taskDir, deleteTask } from './tasks.js'

const LAUNCH_AGENTS_DIR = path.join(os.homedir(), 'Library', 'LaunchAgents')

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

// Fields that require a plist rewrite when changed
const PLIST_DIFFABLE_FIELDS = ['schedule', 'workingDirectory', 'env', 'timeoutSeconds']

// System env keys injected by Tide — excluded when extracting user env from plist
const SYSTEM_ENV_KEYS = new Set(['TIDE_TASK_ID', 'TIDE_TASK_FILE', 'HOME', 'PATH'])

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

/** Parse schedule shorthand string into { type, intervalSeconds } */
function parseSchedule(value) {
  if (!value || value === 'manual') return { type: 'manual' }
  const seconds = SCHEDULE_SHORTHANDS[String(value)]
  if (seconds == null) {
    const n = parseInt(value)
    if (!isNaN(n) && n > 0) return { type: 'interval', intervalSeconds: n }
    return { type: 'manual' }
  }
  return { type: 'interval', intervalSeconds: seconds }
}

/**
 * Parse a .md task file. Returns a task-shaped object with all defaults applied.
 * Reads _* keys for internal fields (id, createdAt, jitterSeconds, enabled).
 * _explicitFields tracks user-authored frontmatter keys (_* internals excluded).
 */
export function parseTaskFile(filePath) {
  const settings = readSettings()
  const raw = fs.readFileSync(filePath, 'utf8')
  const { data: fm, content: body } = matter(raw)

  const INTERNAL_KEYS = new Set(['_id', '_createdAt', '_jitter', '_enabled'])
  // Only user-authored keys go into _explicitFields (not underscore-prefixed internals)
  const _explicitFields = new Set(
    Object.keys(fm).filter(k => !INTERNAL_KEYS.has(k))
  )
  _explicitFields.add('argument')

  const schedule = parseSchedule(fm.schedule)

  return {
    id: fm['_id'] != null ? String(fm['_id']) : null,
    createdAt: fm['_createdAt']
      ? (fm['_createdAt'] instanceof Date ? fm['_createdAt'].toISOString() : String(fm['_createdAt']))
      : null,
    jitterSeconds: fm['_jitter'] ?? null,
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
    enabled: fm['_enabled'] ?? true,
    sourcePath: filePath,
    _explicitFields,
  }
}

/**
 * Write (or update) underscore-prefixed internal fields in a .md file's frontmatter.
 * Only the 4 internal keys (_id, _createdAt, _jitter, _enabled) are touched; user keys are left unchanged.
 */
export function writeTideFields(filePath, fields) {
  const raw = fs.readFileSync(filePath, 'utf8')
  // Split into frontmatter block and everything after the closing ---
  // Format: ---\n<yaml>\n---\n<body>
  const fmEnd = raw.indexOf('\n---', raw.indexOf('---') + 3)
  const fmBlock = fmEnd !== -1 ? raw.slice(0, fmEnd + 4) : raw
  const bodyPart = fmEnd !== -1 ? raw.slice(fmEnd + 4) : ''

  let fm = fmBlock
  for (const [k, v] of Object.entries(fields)) {
    const yamlValue = typeof v === 'boolean' ? String(v) : JSON.stringify(v)
    const quotedKey = `'${k}'`
    const keyRe = new RegExp(`^(${quotedKey}|${k}):\\s*.+$\n?`, 'mg')
    const stripped = fm.replace(keyRe, '')
    // Insert before closing ---
    fm = stripped.replace(/\n---$/, `\n${k}: ${yamlValue}\n---`)
  }
  const tmp = filePath + '.tmp'
  fs.writeFileSync(tmp, fm + bodyPart)
  fs.renameSync(tmp, filePath)
}

/**
 * If the file has no _id, generate one and write it back.
 * Returns the id.
 */
export function ensureTaskId(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8')
  const { data: fm } = matter(raw)
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
 * Read a plist as JSON via plutil. Returns null on failure.
 */
function readPlistJson(plistFile) {
  try {
    const r = spawnSync('plutil', ['-convert', 'json', '-o', '-', plistFile], { encoding: 'utf8' })
    if (r.status !== 0) return null
    return JSON.parse(r.stdout)
  } catch {
    return null
  }
}

/**
 * Extract a task-shaped object from a plist JSON for diffing purposes.
 * Only covers PLIST_DIFFABLE_FIELDS.
 */
function plistToTaskShape(plistJson, jitterSeconds) {
  const startInterval = plistJson.StartInterval
  const schedule = startInterval
    ? { type: 'interval', intervalSeconds: startInterval }
    : { type: 'manual' }

  const workingDirectory = plistJson.WorkingDirectory || os.homedir()

  const envVars = plistJson.EnvironmentVariables || {}
  const env = Object.fromEntries(
    Object.entries(envVars).filter(([k]) => !SYSTEM_ENV_KEYS.has(k))
  )

  const timeOut = plistJson.TimeOut ?? null
  const timeoutSeconds = timeOut !== null ? timeOut - (jitterSeconds ?? 0) : null

  return { schedule, workingDirectory, env, enabled: true, timeoutSeconds }
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
 * Scan all com.tide.*.plist files and return { id, plistFile, tideTaskFile }[]
 */
function scanAllPlists() {
  if (!fs.existsSync(LAUNCH_AGENTS_DIR)) return []
  return fs.readdirSync(LAUNCH_AGENTS_DIR)
    .filter(f => f.startsWith('com.tide.') && f.endsWith('.plist'))
    .map(f => {
      const plistFile = path.join(LAUNCH_AGENTS_DIR, f)
      const id = f.replace(/^com\.tide\./, '').replace(/\.plist$/, '')
      const plistJson = readPlistJson(plistFile)
      const tideTaskFile = plistJson?.EnvironmentVariables?.TIDE_TASK_FILE || null
      return { id, plistFile, tideTaskFile }
    })
}

/**
 * Compute pending sync operations for all .md files under repoRoot, plus global orphan detection.
 */
export function computePending(repoRoot) {
  const pending = []
  const seenIds = new Set()
  const sourcePathMap = {}

  const allPlists = scanAllPlists()
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
  const tideRoots = new Set()
  if (repoRoot) tideRoots.add(repoRoot)
  for (const entry of allPlists) {
    if (entry.tideTaskFile) {
      // TIDE_TASK_FILE is <root>/.tide/<name>.md — root is two levels up
      tideRoots.add(path.dirname(path.dirname(entry.tideTaskFile)))
    }
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
          const plistJson = readPlistJson(plistEntry.plistFile)
          const plistShape = plistJson ? plistToTaskShape(plistJson, parsed.jitterSeconds) : null
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

    // Preserve jitter and createdAt across updates
    const existingJitter = parsed.jitterSeconds
    const jitterSeconds = existingJitter ?? computeJitter(parsed.schedule)
    const createdAt = parsed.createdAt || now

    // Write internal fields back to .md
    writeTideFields(sourcePath, {
      '_id': parsed.id,
      '_createdAt': createdAt,
      '_jitter': jitterSeconds,
      '_enabled': parsed.enabled,
    })

    const task = {
      ...parsed,
      createdAt,
      jitterSeconds,
    }

    // Ensure task dir exists (for run history)
    fs.mkdirSync(path.join(taskDir(task.id), 'logs'), { recursive: true })
    fs.mkdirSync(path.join(taskDir(task.id), 'runs'), { recursive: true })

    if (task.enabled) {
      writePlist(task.id, task)
      bootstrap(task.id)
    }
    // Disabled tasks have no plist — they remain visible via .md discovery only
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
