// Task storage — Phase 2: reads from launchd plists + .md files, no task.json
import fs from 'fs'
import os from 'os'
import path from 'path'
import { bootstrap, bootout, plistPath, readPlistJson, tideTaskFileFromPlist, scanTidePlists, LAUNCH_AGENTS_DIR } from './launchd.js'
import { parseMdFile } from './mdfields.js'
import { writePlist } from './create.js'

const TIDE_DIR = path.join(os.homedir(), '.tide')
export const TASKS_DIR = path.join(TIDE_DIR, 'tasks')

export function taskDir(id) {
  return path.join(TASKS_DIR, id)
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
  const mdPath = tideTaskFileFromPlist(plistJson)
  if (!mdPath || !fs.existsSync(mdPath)) return null
  try {
    const task = parseMdFile(mdPath)
    task.id = task.id || id
    task.createdAt = plistJson.EnvironmentVariables?.TIDE_CREATED_AT || null
    task.jitterSeconds = parseInt(plistJson.EnvironmentVariables?.TIDE_JITTER ?? '') || 0
    return task
  } catch {
    return null
  }
}

/** Read all tasks by scanning all com.tide.*.plist files. Sorted by createdAt ascending. */
export function readTasks() {
  const tasks = scanTidePlists()
    .map(({ id, plistJson, tideTaskFile }) => {
      if (!plistJson || !tideTaskFile || !fs.existsSync(tideTaskFile)) return null
      try {
        const task = parseMdFile(tideTaskFile)
        task.id = task.id || id
        task.disabled = plistJson.Disabled === true
        task.createdAt = plistJson.EnvironmentVariables?.TIDE_CREATED_AT || null
        task.jitterSeconds = parseInt(plistJson.EnvironmentVariables?.TIDE_JITTER ?? '') || 0
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
 * Disable a task: bootout + rewrite plist with Disabled:true.
 * The plist preserves the source path so the task can be re-enabled later.
 */
export function disable(id) {
  const plist = path.join(LAUNCH_AGENTS_DIR, `com.tide.${id}.plist`)
  const plistJson = fs.existsSync(plist) ? readPlistJson(plist) : null
  const mdPath = tideTaskFileFromPlist(plistJson)
  bootout(id)
  if (mdPath && fs.existsSync(mdPath)) {
    const existingEnv = plistJson?.EnvironmentVariables || {}
    const task = parseMdFile(mdPath)
    task.id = id
    task.createdAt = existingEnv.TIDE_CREATED_AT || null
    task.jitterSeconds = parseInt(existingEnv.TIDE_JITTER ?? '') || 0
    writePlist(id, { ...task, enabled: false })
  } else if (fs.existsSync(plist)) {
    // No .md to rewrite from — fall back to deleting the plist
    fs.unlinkSync(plist)
  }
}

/**
 * Enable a task: rewrite plist without Disabled flag and bootstrap.
 * sourcePath is optional — if the plist was already deleted, callers must supply it.
 */
export function setEnabled(id, enabled, sourcePath) {
  if (!enabled) return disable(id)

  // Resolve the .md path: prefer caller-supplied sourcePath, fall back to plist lookup
  let mdPath = sourcePath
  if (!mdPath || !fs.existsSync(mdPath)) {
    const plist = path.join(LAUNCH_AGENTS_DIR, `com.tide.${id}.plist`)
    if (fs.existsSync(plist)) {
      mdPath = tideTaskFileFromPlist(readPlistJson(plist))
    }
  }
  if (!mdPath || !fs.existsSync(mdPath)) throw new Error(`Task ${id}: source .md not found`)

  const plistFile = path.join(LAUNCH_AGENTS_DIR, `com.tide.${id}.plist`)
  const existingPlistJson = fs.existsSync(plistFile) ? readPlistJson(plistFile) : null
  const existingEnv = existingPlistJson?.EnvironmentVariables || {}

  const task = parseMdFile(mdPath)
  task.id = id
  task.createdAt = existingEnv.TIDE_CREATED_AT || null
  task.jitterSeconds = parseInt(existingEnv.TIDE_JITTER ?? '') || 0
  writePlist(id, { ...task, enabled: true })
  bootstrap(id)
}

export function deleteTask(id) {
  const dir = taskDir(id)
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

/**
 * Full task deletion: removes source .md (if present), unregisters from launchd,
 * deletes the plist, and removes run history. Used by both TaskListScreen and TaskDetailScreen.
 */
export function performDeleteTask(id, sourcePath) {
  if (sourcePath && fs.existsSync(sourcePath)) fs.unlinkSync(sourcePath)
  bootout(id)
  const plist = plistPath(id)
  if (fs.existsSync(plist)) fs.unlinkSync(plist)
  deleteTask(id)
}
