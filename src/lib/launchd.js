// launchctl operations
import fs from 'fs'
import { spawnSync, spawn } from 'child_process'
import path from 'path'
import os from 'os'
import { fileURLToPath } from 'url'
import { LAUNCH_AGENTS_DIR } from './constants.js'

export { LAUNCH_AGENTS_DIR }

const PLUGIN_ROOT = path.resolve(fileURLToPath(import.meta.url), '../../..')

/** Read a plist file as parsed JSON via plutil. Returns null on failure. */
export function readPlistJson(plistFile) {
  try {
    const r = spawnSync('plutil', ['-convert', 'json', '-o', '-', plistFile], { encoding: 'utf8' })
    if (r.status !== 0) return null
    return JSON.parse(r.stdout)
  } catch {
    return null
  }
}

/** Extract the TIDE_TASK_FILE path from a parsed plist JSON. Returns null if absent. */
export function tideTaskFileFromPlist(plistJson) {
  return plistJson?.EnvironmentVariables?.TIDE_TASK_FILE || null
}

/**
 * Scan ~/Library/LaunchAgents for all com.tide.*.plist files.
 * Returns [{ id, plistFile, plistJson, tideTaskFile }] — plistJson/tideTaskFile are null on parse failure.
 */
export function scanTidePlists() {
  if (!fs.existsSync(LAUNCH_AGENTS_DIR)) return []
  return fs.readdirSync(LAUNCH_AGENTS_DIR)
    .filter(f => f.startsWith('com.tide.') && f.endsWith('.plist'))
    .map(f => {
      const plistFile = path.join(LAUNCH_AGENTS_DIR, f)
      const id = f.replace(/^com\.tide\./, '').replace(/\.plist$/, '')
      const plistJson = readPlistJson(plistFile)
      const tideTaskFile = tideTaskFileFromPlist(plistJson)
      return { id, plistFile, plistJson, tideTaskFile }
    })
}

function uid() {
  return process.getuid()
}

export function label(taskId) {
  return `com.tide.${taskId}`
}

export function plistPath(taskId) {
  return path.join(LAUNCH_AGENTS_DIR, `${label(taskId)}.plist`)
}

/**
 * Query launchd status for a task.
 * Returns { loaded: bool, pid: number|null, lastExitCode: number|null }
 */
export function getStatus(taskId) {
  try {
    const result = spawnSync('launchctl', ['print', `gui/${uid()}/${label(taskId)}`], {
      encoding: 'utf8',
      timeout: 5000,
    })
    if (result.status !== 0) {
      return { loaded: false, pid: null, lastExitCode: null }
    }
    const stdout = result.stdout || ''
    const pidMatch = stdout.match(/\bpid\s*=\s*(\d+)/)
    const exitMatch = stdout.match(/last exit code\s*=\s*(-?\d+)/)
    return {
      loaded: true,
      pid: pidMatch ? parseInt(pidMatch[1]) : null,
      lastExitCode: exitMatch ? parseInt(exitMatch[1]) : null,
    }
  } catch {
    return { loaded: false, pid: null, lastExitCode: null }
  }
}

/** Bootstrap (enable) a task's plist with launchctl. Bootout first to ensure idempotency. */
export function bootstrap(taskId) {
  // Unload first — launchd rejects bootstrap if the label is already registered
  spawnSync('launchctl', ['bootout', `gui/${uid()}/${label(taskId)}`], {
    encoding: 'utf8',
    timeout: 10000,
  })
  const plist = plistPath(taskId)
  const result = spawnSync('launchctl', ['bootstrap', `gui/${uid()}`, plist], {
    encoding: 'utf8',
    timeout: 10000,
  })
  if (result.status !== 0) {
    throw new Error(`launchctl bootstrap failed: ${result.stderr || result.stdout}`)
  }
}

/** Bootout (disable) a task from launchctl. Ignores errors if not loaded. */
export function bootout(taskId) {
  spawnSync('launchctl', ['bootout', `gui/${uid()}/${label(taskId)}`], {
    encoding: 'utf8',
    timeout: 10000,
  })
}

/**
 * Manually trigger a task immediately, skipping jitter.
 * Runs tide.sh directly with TIDE_NO_JITTER=1 and TIDE_TASK_FILE from the plist.
 *
 * options:
 *   overrideArgument  string  — passed as TIDE_OVERRIDE_ARGUMENT; replaces the task's argument for this run
 *   parentRunId       string  — passed as TIDE_PARENT_RUN_ID; recorded in run.json for follow-up chains
 */
export function kickstart(taskId, { overrideArgument, parentRunId } = {}) {
  const runner = path.join(PLUGIN_ROOT, 'scripts', 'tide.sh')

  // Read TIDE_TASK_FILE from the plist so tide.sh can find the .md source
  let tideTaskFile = ''
  try {
    tideTaskFile = tideTaskFileFromPlist(readPlistJson(plistPath(taskId))) || ''
  } catch { /* fall through — tide.sh will error with a clear message */ }

  const env = {
    ...process.env,
    TIDE_TASK_ID: taskId,
    TIDE_NO_JITTER: '1',
    ...(tideTaskFile ? { TIDE_TASK_FILE: tideTaskFile } : {}),
    ...(overrideArgument !== undefined ? { TIDE_OVERRIDE_ARGUMENT: overrideArgument } : {}),
    ...(parentRunId ? { TIDE_PARENT_RUN_ID: parentRunId } : {}),
  }
  const child = spawn(runner, [taskId], {
    env,
    detached: true,
    stdio: 'ignore',
  })
  child.unref()
  return { method: 'direct' }
}
