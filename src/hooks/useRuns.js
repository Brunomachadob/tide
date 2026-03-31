import { useState, useEffect, useCallback } from 'react'
import { getRuns } from '../lib/runs.js'

export function useRuns(taskId, count = 5) {
  const [runs, setRuns] = useState([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(() => {
    try {
      setRuns(getRuns(taskId, count))
    } catch {
      setRuns([])
    } finally {
      setLoading(false)
    }
  }, [taskId, count])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { runs, loading, refresh }
}
