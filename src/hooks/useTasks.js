import { useState, useEffect, useCallback } from 'react'
import fs from 'fs'
import { readTasks, taskDir } from '../lib/tasks.js'
import { formatSchedule } from '../lib/format.js'
import { getStatus } from '../lib/launchd.js'
import { getLatestCompletedRun, getRuns } from '../lib/runs.js'

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

function loadTasks() {
  const { tasks } = readTasks()
  return tasks.map(task => {
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
    return { ...task, status, launchdExitCode: launchd.lastExitCode, lastResult, recentResults, scheduleLabel: formatSchedule(task.schedule) }
  })
}

export function useTasks(intervalMs = 5000) {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(() => {
    try {
      setTasks(loadTasks())
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, intervalMs)
    return () => clearInterval(id)
  }, [refresh, intervalMs])

  return { tasks, loading, error, refresh }
}

export function useTask(taskId, intervalMs = 5000) {
  const [task, setTask] = useState(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(() => {
    try {
      const all = loadTasks()
      setTask(all.find(t => t.id === taskId) || null)
    } catch {
      setTask(null)
    } finally {
      setLoading(false)
    }
  }, [taskId])

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, intervalMs)
    return () => clearInterval(id)
  }, [refresh, intervalMs])

  return { task, loading, refresh }
}
