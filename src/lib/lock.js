// Run lock file helpers — written by agent-runner.js, read by load-tasks.js.
// Lock file format: <runId>:<pid>  e.g. "a3f2c1b0:12345"
import fs from 'fs'
import path from 'path'
import { safeReadJSON } from './io.js'

const LOCK_FILE = 'running.pid'

function lockPath(tDir) {
  return path.join(tDir, LOCK_FILE)
}

/**
 * Attempt to acquire the run lock for tDir.
 * If a lock exists and the owning process is still alive and its run is
 * still in progress, returns { acquired: false }.
 * Otherwise clears any stale lock, writes a fresh one, and returns { acquired: true }.
 */
export function acquireLock(tDir, runId) {
  const file = lockPath(tDir)
  if (fs.existsSync(file)) {
    const [, existingPid] = fs.readFileSync(file, 'utf8').trim().split(':')
    if (existingPid) {
      try {
        process.kill(parseInt(existingPid), 0)
        return { acquired: false, existingPid }
      } catch { /* process gone — stale lock */ }
    }
    fs.rmSync(file, { force: true })
  }
  fs.mkdirSync(tDir, { recursive: true })
  fs.writeFileSync(file, `${runId}:${process.pid}`)
  return { acquired: true }
}

/**
 * Release the lock by deleting the lock file. Safe to call if already absent.
 */
export function releaseLock(tDir) {
  try { fs.rmSync(lockPath(tDir), { force: true }) } catch { /* ok */ }
}

/**
 * Check whether a task directory has an active lock.
 * Returns true only if the lock file exists, the PID is alive, and the
 * corresponding run.json has no completedAt (guards against PID reuse).
 */
export function isLocked(tDir) {
  try {
    const [runId, pidStr] = fs.readFileSync(lockPath(tDir), 'utf8').trim().split(':')
    if (!runId || !pidStr) return false
    process.kill(parseInt(pidStr), 0)
    const run = safeReadJSON(path.join(tDir, 'runs', runId, 'run.json'))
    return run !== null && !run.completedAt
  } catch {
    return false
  }
}
