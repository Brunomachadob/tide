// Pure function: reads all tasks + status + run history. No side effects.
// Used by useTasks (via worker) and directly in tests.
import path from 'path'
import { readTasks, taskDir } from './tasks.js'
import { formatSchedule } from './format.js'
import { getStatus } from './launchd.js'
import { getLatestCompletedRun, getRuns } from './runs.js'
import { computePending } from './taskfile.js'
import { isLocked } from './lock.js'

export function loadTasks(repoRoot) {
  let pendingMap = {}
  let sourcePathMap = {}
  try {
    const result = computePending(repoRoot)
    sourcePathMap = result.sourcePathMap
    for (const entry of result.pending) {
      const id = entry.task.id
      if (id) pendingMap[id] = entry
    }
  } catch {
    // Non-fatal: if taskfile scanning fails, just show no pending
  }

  const { tasks } = readTasks()

  const result = tasks.map(task => {
    const launchd = getStatus(task.id)
    let status
    if (launchd.pid || isLocked(taskDir(task.id))) {
      status = 'running'
    } else if (task.disabled) {
      status = 'disabled'
    } else if (launchd.loaded && launchd.lastExitCode !== null && launchd.lastExitCode !== 0) {
      status = 'launchd-error'
    } else if (launchd.loaded) {
      status = 'loaded'
    } else {
      status = 'not loaded'
    }
    const lastResult = getLatestCompletedRun(task.id)
    const recentResults = getRuns(task.id, 5)
    const pendingEntry = pendingMap[task.id]
    const syncStatus = pendingEntry ? pendingEntry.type : null
    const syncDiff = pendingEntry?.diff || []
    const sourcePath = task.sourcePath || pendingEntry?.task?.sourcePath || sourcePathMap[task.id] || null
    delete pendingMap[task.id]
    return {
      ...task,
      sourcePath,
      status,
      launchdExitCode: launchd.lastExitCode,
      lastResult,
      recentResults,
      scheduleLabel: formatSchedule(task.schedule),
      syncStatus,
      syncDiff,
    }
  })

  // Ghost entries for pending-create and orphans (no live task entry to attach to)
  for (const entry of Object.values(pendingMap)) {
    if (entry.type === 'create') {
      const ghostId = entry.task.id
      result.push({
        ...entry.task,
        status: entry.task.disabled === true ? 'disabled' : 'not loaded',
        launchdExitCode: null,
        lastResult: ghostId ? getLatestCompletedRun(ghostId) : null,
        recentResults: ghostId ? getRuns(ghostId, 5) : [],
        scheduleLabel: formatSchedule(entry.task.schedule),
        syncStatus: entry.task.disabled === true ? null : 'create',
        syncDiff: [],
      })
    } else if (entry.type === 'orphan') {
      result.push({
        id: entry.task.id,
        name: entry.task.id,  // no .md to read a name from
        sourcePath: entry.task.sourcePath,
        status: 'not loaded',
        launchdExitCode: null,
        lastResult: null,
        recentResults: [],
        scheduleLabel: '-',
        syncStatus: 'orphan',
        syncDiff: [],
      })
    }
  }

  return result
}
