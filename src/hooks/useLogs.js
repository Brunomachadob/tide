import { useState, useEffect, useCallback } from 'react'
import fs from 'fs'
import path from 'path'
import { getOutputLog, getStderrLog, getOutputLogLineCount, getStderrLogLineCount } from '../lib/logs.js'
import { TASKS_DIR } from '../lib/tasks.js'

export function useLogs(taskId, lines = 50, autoRefresh = false) {
  const [output, setOutput] = useState(null)
  const [stderr, setStderr] = useState(null)
  const [outputTotal, setOutputTotal] = useState(null)
  const [stderrTotal, setStderrTotal] = useState(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(() => {
    try {
      setOutput(getOutputLog(taskId, lines))
      setStderr(getStderrLog(taskId, lines))
      setOutputTotal(getOutputLogLineCount(taskId))
      setStderrTotal(getStderrLogLineCount(taskId))
    } catch {
      // keep last values
    } finally {
      setLoading(false)
    }
  }, [taskId, lines])

  useEffect(() => {
    refresh()
    if (!autoRefresh) return

    // Watch the logs directory for changes and refresh immediately on any write.
    // Fall back to polling every 10s in case fs.watch misses an event.
    const logsDir = path.join(TASKS_DIR, taskId, 'logs')
    let watcher = null
    try {
      watcher = fs.watch(logsDir, refresh)
    } catch {
      // logs dir may not exist yet if task has never run — polling handles it
    }
    const id = setInterval(refresh, 10000)
    return () => {
      watcher?.close()
      clearInterval(id)
    }
  }, [refresh, autoRefresh, taskId])

  return { output, stderr, outputTotal, stderrTotal, loading, refresh }
}
