// Task storage — Phase 2: reads from launchd plists + .md files, no task.json
import fs from 'fs'
import os from 'os'
import path from 'path'
import { spawnSync } from 'child_process'
import matter from 'gray-matter'
import { readSettings } from './settings.js'
import { bootstrap, bootout } from './launchd.js'

const TIDE_DIR = path.join(os.homedir(), '.tide')
export const TASKS_DIR = path.join(TIDE_DIR, 'tasks')
const LAUNCH_AGENTS_DIR = path.join(os.homedir(), 'Library', 'LaunchAgents')

export function taskDir(id) {
  return path.join(TASKS_DIR, id)
}

/** Read a plist file as parsed JSON via plutil. Returns null on failure. */
function readPlistJson(plistFile) {
  try {
    const r = spawnSync('plutil', ['-convert', 'json', '-o', '-', plistFile], { encoding: 'utf8' })
    if (r.status !== 0) return null
    return JSON.parse(r.stdout)
  } catch {
    return null
  }
}

const SCHEDULE_SHORTHANDS = {
  manual: null, '15m': 900, '30m': 1800, '1h': 3600, '2h': 7200, '6h': 21600, '12h': 43200, '24h': 86400,
}

function parseSchedule(value) {
  if (!value || value === 'manual') return { type: 'manual' }
  const seconds = SCHEDULE_SHORTHANDS[String(value)]
  if (seconds != null) return { type: 'interval', intervalSeconds: seconds }
  const n = parseInt(value)
  if (!isNaN(n) && n > 0) return { type: 'interval', intervalSeconds: n }
  return { type: 'manual' }
}

/** Parse a .md file into a task-shaped object (minimal, for readTask/readTasks). */
function parseMd(mdPath) {
  const settings = readSettings()
  const raw = fs.readFileSync(mdPath, 'utf8')
  const { data: fm, content: body } = matter(raw)
  return {
    id: fm['_id'] != null ? String(fm['_id']) : null,
    createdAt: fm['_createdAt']
      ? (fm['_createdAt'] instanceof Date ? fm['_createdAt'].toISOString() : String(fm['_createdAt']))
      : null,
    jitterSeconds: fm['_jitter'] ?? null,
    enabled: fm['_enabled'] ?? true,
    name: fm.name || path.basename(mdPath, '.md'),
    argument: body.trim(),
    command: fm.command || settings.command || '',
    extraArgs: fm.extraArgs || [],
    schedule: parseSchedule(fm.schedule),
    workingDirectory: fm.workingDirectory
      ? fm.workingDirectory.replace(/^~/, os.homedir())
      : (settings.defaultWorkingDirectory || os.homedir()),
    maxRetries: fm.maxRetries ?? 0,
    env: fm.env || {},
    resultRetentionDays: fm.resultRetentionDays ?? 30,
    claudeStreamJson: fm.claudeStreamJson ?? false,
    timeoutSeconds: fm.timeoutSeconds ?? null,
    sourcePath: mdPath,
  }
}

/** Extract task ID from a plist filename (com.tide.<id>.plist). */
function idFromPlistName(filename) {
  return filename.replace(/^com\.tide\./, '').replace(/\.plist$/, '')
}

/**
 * Read a single task by ID. Parses the plist to get TIDE_TASK_FILE, then reads the .md.
 * Returns null if plist or .md is missing/unreadable.
 */
export function readTask(id) {
  const plistFile = path.join(LAUNCH_AGENTS_DIR, `com.tide.${id}.plist`)
  if (!fs.existsSync(plistFile)) return null
  const plistJson = readPlistJson(plistFile)
  if (!plistJson) return null
  const mdPath = plistJson?.EnvironmentVariables?.TIDE_TASK_FILE
  if (!mdPath || !fs.existsSync(mdPath)) return null
  try {
    const task = parseMd(mdPath)
    task.id = task.id || id
    return task
  } catch {
    return null
  }
}

/** Read all tasks by scanning all com.tide.*.plist files. Sorted by createdAt ascending. */
export function readTasks() {
  if (!fs.existsSync(LAUNCH_AGENTS_DIR)) return { tasks: [] }

  const tasks = fs.readdirSync(LAUNCH_AGENTS_DIR)
    .filter(f => f.startsWith('com.tide.') && f.endsWith('.plist'))
    .map(f => {
      const id = idFromPlistName(f)
      const plistFile = path.join(LAUNCH_AGENTS_DIR, f)
      const plistJson = readPlistJson(plistFile)
      if (!plistJson) return null
      const mdPath = plistJson?.EnvironmentVariables?.TIDE_TASK_FILE
      if (!mdPath || !fs.existsSync(mdPath)) return null
      try {
        const task = parseMd(mdPath)
        task.id = task.id || id
        return task
      } catch {
        return null
      }
    })
    .filter(Boolean)
    .sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')))

  return { tasks }
}

/**
 * Disable a task: bootout + delete plist + write _enabled=false to .md.
 * For enabling, use applyPending (which writes the plist and bootstraps).
 */
export function disable(id) {
  const plist = path.join(LAUNCH_AGENTS_DIR, `com.tide.${id}.plist`)
  const plistJson = fs.existsSync(plist) ? readPlistJson(plist) : null
  const mdPath = plistJson?.EnvironmentVariables?.TIDE_TASK_FILE
  bootout(id)
  if (fs.existsSync(plist)) fs.unlinkSync(plist)
  if (mdPath && fs.existsSync(mdPath)) {
    writeTideFieldsInline(mdPath, { '_enabled': false })
  }
}

/**
 * Disable a task or mark it as enabled in the .md.
 * For enable: only writes _enabled=true to the .md. The caller is responsible for
 * re-creating the plist via applyPending (taskfile.js) if needed.
 * sourcePath is optional — if the plist was already deleted, callers must supply it.
 */
export function setEnabled(id, enabled, sourcePath) {
  if (!enabled) return disable(id)

  // Resolve the .md path: prefer caller-supplied sourcePath, fall back to plist lookup
  let mdPath = sourcePath
  if (!mdPath || !fs.existsSync(mdPath)) {
    const plist = path.join(LAUNCH_AGENTS_DIR, `com.tide.${id}.plist`)
    if (fs.existsSync(plist)) {
      const plistJson = readPlistJson(plist)
      mdPath = plistJson?.EnvironmentVariables?.TIDE_TASK_FILE
    }
  }
  if (!mdPath || !fs.existsSync(mdPath)) throw new Error(`Task ${id}: source .md not found`)

  writeTideFieldsInline(mdPath, { '_enabled': true })
  // Caller must invoke applyPending to re-create the plist and bootstrap.
}

/** Inline version of writeTideFields to avoid circular import with taskfile.js */
function writeTideFieldsInline(filePath, fields) {
  const raw = fs.readFileSync(filePath, 'utf8')
  // Split into frontmatter block and everything after the closing ---
  const fmEnd = raw.indexOf('\n---', raw.indexOf('---') + 3)
  const fmBlock = fmEnd !== -1 ? raw.slice(0, fmEnd + 4) : raw
  const bodyPart = fmEnd !== -1 ? raw.slice(fmEnd + 4) : ''

  let fm = fmBlock
  for (const [k, v] of Object.entries(fields)) {
    const yamlValue = typeof v === 'boolean' ? String(v) : JSON.stringify(v)
    // Try to update an existing key (quoted or unquoted form) — only within fm block
    const quotedKey = `'${k}'`
    const replaced = fm.replace(
      new RegExp(`^(${quotedKey}|${k}):\\s*.+$`, 'm'),
      `${k}: ${yamlValue}`
    )
    if (replaced !== fm) {
      fm = replaced
    } else {
      // Key not found — insert before closing --- (replace the trailing \n--- in fmBlock)
      fm = fm.replace(/\n---$/, `\n${k}: ${yamlValue}\n---`)
    }
  }
  const tmp = filePath + '.tmp'
  fs.writeFileSync(tmp, fm + bodyPart)
  fs.renameSync(tmp, filePath)
}

export function deleteTask(id) {
  const dir = taskDir(id)
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}
