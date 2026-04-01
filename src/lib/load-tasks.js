// Pure function: reads all tasks + status + run history. No side effects.
// Used by useTasks (via worker) and directly in tests.
import fs from 'fs'
import { readTasks, taskDir } from './tasks.js'
import { formatSchedule } from './format.js'
import { getStatus } from './launchd.js'
import { getLatestCompletedRun, getRuns } from './runs.js'
import { computePending } from './taskfile.js'

function isRunningViaPidFile(taskId) {
  try {
    const pidFile = `${taskDir(taskId)}/running.pid`
    const pid = parseInt(fs.readFileSync(pidFile, 'utf8').trim())
    if (!pid) return false
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

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
    if (launchd.pid || isRunningViaPidFile(task.id)) {
      status = 'running'
    } else if (!task.enabled) {
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

  // Ghost entries for pending-create (no plist yet)
  for (const entry of Object.values(pendingMap)) {
    if (entry.type === 'create') {
      result.push({
        ...entry.task,
        status: entry.task.enabled === false ? 'disabled' : 'not loaded',
        launchdExitCode: null,
        lastResult: null,
        recentResults: [],
        scheduleLabel: formatSchedule(entry.task.schedule),
        syncStatus: entry.task.enabled === false ? null : 'create',
        syncDiff: [],
      })
    }
  }

  return result
}
