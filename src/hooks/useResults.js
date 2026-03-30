import { useState, useEffect, useCallback } from 'react'
import { createRequire } from 'module'
import path from 'path'
import { fileURLToPath } from 'url'

const require = createRequire(import.meta.url)
const libPath = path.resolve(fileURLToPath(import.meta.url), '../../../../lib')
const { getResults } = require(path.join(libPath, 'results'))

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
