// read task run records from ~/.tide/tasks/<id>/runs/
import fs from 'fs'
import path from 'path'
import { TASKS_DIR } from './tasks.js'
import { safeReadJSON } from './io.js'

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
    const runFile = path.join(dir, entry, 'run.json')
    const data = safeReadJSON(runFile)
    if (data) acc.push(data)
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
    const data = safeReadJSON(path.join(dir, entry, 'run.json'))
    if (!data?.completedAt) continue
    if (!latest || data.startedAt > latest.startedAt) latest = data
  }
  return latest
}
