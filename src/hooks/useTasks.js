import { useState, useEffect, useCallback } from 'react'
import fs from 'fs'
import { readTasks, taskDir } from '../lib/tasks.js'
import { formatSchedule } from '../lib/format.js'
import { getStatus } from '../lib/launchd.js'
import { getLatestCompletedRun, getRuns } from '../lib/runs.js'
import { computePending } from '../lib/taskfile.js'

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

function loadTasks(repoRoot) {
  // Compute pending sync ops (does not apply them — user must press [s])
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

  // Merge runtime status + sync status for existing tasks
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
    const syncStatus = pendingEntry ? pendingEntry.type : null  // 'update' | 'orphan' | null
    const syncDiff = pendingEntry?.diff || []
    // Carry sourcePath: from task.json, pending entry, or sourcePathMap (in-sync tasks)
    const sourcePath = task.sourcePath || pendingEntry?.task?.sourcePath || sourcePathMap[task.id] || null
    delete pendingMap[task.id]  // handled
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

  // Add ghost entries for pending-create (no task.json yet)
  for (const entry of Object.values(pendingMap)) {
    if (entry.type === 'create') {
      result.push({
        ...entry.task,
        status: 'not loaded',
        launchdExitCode: null,
        lastResult: null,
        recentResults: [],
        scheduleLabel: formatSchedule(entry.task.schedule),
        syncStatus: 'create',
        syncDiff: [],
      })
    }
  }

  return result
}

export function useTasks(intervalMs = 5000, repoRoot = null) {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(() => {
    try {
      setTasks(loadTasks(repoRoot))
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [repoRoot])

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, intervalMs)
    return () => clearInterval(id)
  }, [refresh, intervalMs])

  return { tasks, loading, error, refresh }
}

export function useTask(taskId, intervalMs = 5000, repoRoot = null) {
  const [task, setTask] = useState(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(() => {
    try {
      const all = loadTasks(repoRoot)
      setTask(all.find(t => t.id === taskId) || null)
    } catch {
      setTask(null)
    } finally {
      setLoading(false)
    }
  }, [taskId, repoRoot])

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, intervalMs)
    return () => clearInterval(id)
  }, [refresh, intervalMs])

  return { task, loading, refresh }
}
