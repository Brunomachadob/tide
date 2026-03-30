// read task execution result JSON files
import fs from 'fs'
import path from 'path'
import { TASKS_DIR } from './tasks.js'
import { safeReadJSON } from './io.js'

function resultsDir(taskId) {
  return path.join(TASKS_DIR, taskId, 'results')
}

/**
 * Returns the last `count` results for a task, most recent first.
 * Returns [] if no results directory or no result files.
 */
export function getResults(taskId, count = 5) {
  const dir = resultsDir(taskId)
  if (!fs.existsSync(dir)) return []

  const recent = fs.readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .sort()
    .slice(-count)
    .reverse()

  return recent.map(f => {
    const filePath = path.join(dir, f)
    const data = safeReadJSON(filePath)
    return data ?? { file: filePath, error: 'failed to parse' }
  })
}

/** Returns the single most recent result, or null if none. */
export function getLatestResult(taskId) {
  const results = getResults(taskId, 1)
  return results.length ? results[0] : null
}
