import { useState, useEffect, useCallback } from 'react'
import { createRequire } from 'module'
import path from 'path'
import { fileURLToPath } from 'url'

const require = createRequire(import.meta.url)
const libPath = path.resolve(fileURLToPath(import.meta.url), '../../../../lib')
const { getOutputLog, getStderrLog } = require(path.join(libPath, 'logs'))

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
