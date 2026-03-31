// launchctl operations
import { spawnSync, spawn } from 'child_process'
import path from 'path'
import os from 'os'
import { fileURLToPath } from 'url'

const PLUGIN_ROOT = path.resolve(fileURLToPath(import.meta.url), '../../..')
const LAUNCH_AGENTS_DIR = path.join(os.homedir(), 'Library', 'LaunchAgents')

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
 * Runs task-runner.sh directly with TIDE_NO_JITTER=1 so the task starts
 * without delay regardless of the configured jitterSeconds.
 */
export function kickstart(taskId) {
  const runner = path.join(PLUGIN_ROOT, 'scripts', 'task-runner.sh')
  const env = { ...process.env, TIDE_TASK_ID: taskId, TIDE_NO_JITTER: '1' }
  const child = spawn(runner, [taskId], {
    env,
    detached: true,
    stdio: 'ignore',
  })
  child.unref()
  return { method: 'direct' }
}
