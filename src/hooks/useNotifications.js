import { useState, useEffect, useCallback } from 'react'
import { createRequire } from 'module'
import path from 'path'
import { fileURLToPath } from 'url'

const require = createRequire(import.meta.url)
const libPath = path.resolve(fileURLToPath(import.meta.url), '../../../../lib')
const { getNotifications, clearNotifications } = require(path.join(libPath, 'notifications'))

export function useNotifications(intervalMs = 10000) {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(() => {
    try {
      setNotifications(getNotifications())
    } catch {
      setNotifications([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, intervalMs)
    return () => clearInterval(id)
  }, [refresh, intervalMs])

  const clear = useCallback(() => {
    clearNotifications()
    setNotifications([])
  }, [])

  return { notifications, loading, refresh, clear }
}
