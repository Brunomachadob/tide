import { useState, useEffect, useCallback } from 'react'
import { readTasks, formatSchedule } from '../lib/tasks.js'
import { getStatus } from '../lib/launchd.js'
import { getLatestResult } from '../lib/results.js'

function loadTasks() {
  const { tasks } = readTasks()
  return tasks.map(task => {
    const launchd = getStatus(task.id)
    let status
    if (!task.enabled) {
      status = 'disabled'
    } else if (launchd.loaded) {
      status = launchd.pid ? 'running' : 'loaded'
    } else {
      status = 'not loaded'
    }
    const lastResult = getLatestResult(task.id)
    return { ...task, status, lastResult, scheduleLabel: formatSchedule(task.schedule) }
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
