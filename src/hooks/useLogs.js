import { useState, useEffect, useCallback } from 'react'
import { getOutputLog, getStderrLog, getOutputLogLineCount, getStderrLogLineCount } from '../lib/logs.js'

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
    const id = setInterval(refresh, 3000)
    return () => clearInterval(id)
  }, [refresh, autoRefresh])

  return { output, stderr, outputTotal, stderrTotal, loading, refresh }
}
