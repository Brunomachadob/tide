// read task run records from ~/.tide/tasks/<id>/runs/
import fs from 'fs'
import path from 'path'
import { TASKS_DIR, taskDir } from './tasks.js'
import { safeReadJSON, atomicWriteJSON } from './io.js'

/**
 * If a run has no completedAt and its shell process is no longer alive,
 * mark it as abandoned in-place so it doesn't stay stuck as "running" forever.
 */
export function finalizeAbandonedRun(taskId, run, runDir) {
  if (run.completedAt) return run
  const pidFile = path.join(taskDir(taskId), 'running.pid')
  let pidFileExists = false
  let processAlive = false
  try {
    const pid = parseInt(fs.readFileSync(pidFile, 'utf8').trim())
    pidFileExists = true
    if (pid) process.kill(pid, 0)
    processAlive = true
  } catch (e) {
    if (e.code !== 'ENOENT') pidFileExists = true  // file exists but process dead
  }

  if (processAlive) return run

  // PID file present but process dead → definitely abandoned
  // No PID file but run is old (> 5 min) → process crashed before writing pid
  const staleCutoff = 5 * 60 * 1000
  const isOld = run.startedAt && (Date.now() - new Date(run.startedAt).getTime()) > staleCutoff
  if (!pidFileExists && !isOld) return run

  const finalized = { ...run, completedAt: run.startedAt, exitCode: -1, abandoned: true }
  try { atomicWriteJSON(path.join(runDir, 'run.json'), finalized) } catch { /* best effort */ }
  return finalized
}

function runsDir(taskId) {
  return path.join(TASKS_DIR, taskId, 'runs')
}

/**
 * Returns the last `count` runs for a task, most recent first.
 * Includes in-progress runs (no completedAt). Returns [] if no runs dir or no runs.
 */
export function getRuns(taskId, count = 5) {
  const dir = runsDir(taskId)
  if (!fs.existsSync(dir)) return []

  const entries = fs.readdirSync(dir).filter(entry => {
    try {
      return fs.statSync(path.join(dir, entry)).isDirectory()
    } catch { return false }
  })

  const runs = entries.reduce((acc, entry) => {
    const runDir = path.join(dir, entry)
    const runFile = path.join(runDir, 'run.json')
    let data = safeReadJSON(runFile)
    if (data) {
      data = finalizeAbandonedRun(taskId, data, runDir)
      acc.push(data)
    }
    return acc
  }, [])

  runs.sort((a, b) => {
    if (!a.startedAt) return 1
    if (!b.startedAt) return -1
    return a.startedAt < b.startedAt ? 1 : a.startedAt > b.startedAt ? -1 : 0
  })

  return runs.slice(0, count)
}

/** Returns the single most recent run, or null if none. */
export function getLatestRun(taskId) {
  const runs = getRuns(taskId, 1)
  return runs.length ? runs[0] : null
}

/** Returns the most recent completed run (has completedAt), or null if none. */
export function getLatestCompletedRun(taskId) {
  const dir = runsDir(taskId)
  if (!fs.existsSync(dir)) return null

  const entries = fs.readdirSync(dir).filter(entry => {
    try { return fs.statSync(path.join(dir, entry)).isDirectory() } catch { return false }
  })

  let latest = null
  for (const entry of entries) {
    const runDir = path.join(dir, entry)
    let data = safeReadJSON(path.join(runDir, 'run.json'))
    if (!data) continue
    if (!data.completedAt) data = finalizeAbandonedRun(taskId, data, runDir)
    if (!data.completedAt) continue
    if (!latest || data.startedAt > latest.startedAt) latest = data
  }
  return latest
}
