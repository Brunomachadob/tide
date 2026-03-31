import { useState, useEffect, useCallback } from 'react'
import { getNotifications, clearNotifications, dismissNotification } from '../lib/notifications.js'

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

  const dismiss = useCallback((taskId, completedAt) => {
    dismissNotification(taskId, completedAt)
    setNotifications(prev => prev.filter(n => !(n.taskId === taskId && n.completedAt === completedAt)))
  }, [])

  return { notifications, loading, refresh, clear, dismiss }
}
