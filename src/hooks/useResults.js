import { useState, useEffect, useCallback } from 'react'
import { getResults } from '../lib/results.js'

export function useResults(taskId, count = 5) {
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(() => {
    try {
      setResults(getResults(taskId, count))
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [taskId, count])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { results, loading, refresh }
}
