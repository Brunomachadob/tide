// lib/launchd.js — launchctl operations
'use strict'

const { execSync, spawnSync } = require('child_process')
const path = require('path')
const os = require('os')

const PLUGIN_ROOT = path.resolve(__dirname, '..')
const SCHEDULER_DIR = path.join(os.homedir(), '.claude', 'scheduler')
const LAUNCH_AGENTS_DIR = path.join(os.homedir(), 'Library', 'LaunchAgents')

function uid() {
  return process.getuid()
}

function label(taskId) {
  return `com.claude.scheduler.${taskId}`
}

function plistPath(taskId) {
  return path.join(LAUNCH_AGENTS_DIR, `${label(taskId)}.plist`)
}

/**
 * Query launchd status for a task.
 * Returns { loaded: bool, pid: number|null, lastExitCode: number|null }
 */
function getStatus(taskId) {
  try {
    const result = spawnSync('launchctl', ['print', `gui/${uid()}/${label(taskId)}`], {
      encoding: 'utf8',
      timeout: 5000,
    })
    if (result.status !== 0) {
      return { loaded: false, pid: null, lastExitCode: null }
    }
    const stdout = result.stdout || ''
    // Parse: "pid = 12345" and "last exit code = 0"
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

/**
 * Bootstrap (enable) a task's plist with launchctl.
 */
function bootstrap(taskId) {
  const plist = plistPath(taskId)
  const result = spawnSync('launchctl', ['bootstrap', `gui/${uid()}`, plist], {
    encoding: 'utf8',
    timeout: 10000,
  })
  if (result.status !== 0) {
    throw new Error(`launchctl bootstrap failed: ${result.stderr || result.stdout}`)
  }
}

/**
 * Bootout (disable) a task from launchctl. Ignores errors if not loaded.
 */
function bootout(taskId) {
  spawnSync('launchctl', ['bootout', `gui/${uid()}/${label(taskId)}`], {
    encoding: 'utf8',
    timeout: 10000,
  })
  // Ignore exit code — task may already be unloaded
}

/**
 * Manually trigger a task immediately.
 * Tries launchctl kickstart first; falls back to running task-runner.sh directly.
 */
function kickstart(taskId) {
  const result = spawnSync('launchctl', ['kickstart', '-p', `gui/${uid()}/${label(taskId)}`], {
    encoding: 'utf8',
    timeout: 10000,
  })
  if (result.status === 0) {
    return { method: 'launchctl' }
  }
  // Fallback: run task-runner.sh directly
  const runner = path.join(PLUGIN_ROOT, 'scripts', 'task-runner.sh')
  const env = { ...process.env, CLAUDE_SCHEDULER_TASK_ID: taskId }
  const fallback = spawnSync(runner, [taskId], { encoding: 'utf8', env, timeout: 120000 })
  if (fallback.status !== 0) {
    throw new Error(`task-runner.sh failed (exit ${fallback.status}): ${fallback.stderr}`)
  }
  return { method: 'direct' }
}

module.exports = { getStatus, bootstrap, bootout, kickstart, plistPath, label }
