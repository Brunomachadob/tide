import { useState, useEffect, useCallback } from 'react'
import fs from 'fs'
import path from 'path'
import { getRunOutputLog, getRunStderrLog, getRunOutputLogLineCount, getRunStderrLogLineCount } from '../lib/logs.js'
import { TASKS_DIR } from '../lib/tasks.js'

export function useRunLogs(taskId, runId, lines = 50, autoRefresh = false) {
  const [output, setOutput] = useState(null)
  const [stderr, setStderr] = useState(null)
  const [outputTotal, setOutputTotal] = useState(null)
  const [stderrTotal, setStderrTotal] = useState(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(() => {
    try {
      setOutput(getRunOutputLog(taskId, runId, lines))
      setStderr(getRunStderrLog(taskId, runId, lines))
      setOutputTotal(getRunOutputLogLineCount(taskId, runId))
      setStderrTotal(getRunStderrLogLineCount(taskId, runId))
    } catch {
      // keep last values
    } finally {
      setLoading(false)
    }
  }, [taskId, runId, lines])

  useEffect(() => {
    refresh()
    if (!autoRefresh) return

    // Watch the run directory for changes and refresh immediately on any write.
    // Fall back to polling every 10s in case fs.watch misses an event.
    const runDir = path.join(TASKS_DIR, taskId, 'runs', runId)
    let watcher = null
    try {
      watcher = fs.watch(runDir, refresh)
    } catch {
      // run dir may not exist yet — polling handles it
    }
    const id = setInterval(refresh, 10000)
    return () => {
      watcher?.close()
      clearInterval(id)
    }
  }, [refresh, autoRefresh, taskId, runId])

  return { output, stderr, outputTotal, stderrTotal, loading, refresh }
}
