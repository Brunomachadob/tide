import { useState, useEffect, useCallback } from 'react'
import { getOutputLog, getStderrLog } from '../lib/logs.js'

export function useLogs(taskId, lines = 50, autoRefresh = false) {
  const [output, setOutput] = useState(null)
  const [stderr, setStderr] = useState(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(() => {
    try {
      setOutput(getOutputLog(taskId, lines))
      setStderr(getStderrLog(taskId, lines))
    } catch {
      // keep last values
    } finally {
      setLoading(false)
    }
  }, [taskId, lines])

  useEffect(() => {
    refresh()
    if (!autoRefresh) return
    const id = setInterval(refresh, 3000)
    return () => clearInterval(id)
  }, [refresh, autoRefresh])

  return { output, stderr, loading, refresh }
}
