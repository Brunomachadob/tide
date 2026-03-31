import { useState, useEffect, useCallback } from 'react'
import {
  getNotifications,
  clearNotifications,
  clearReadNotifications,
  dismissNotification,
  markNotificationRead,
  markAllNotificationsRead,
} from '../lib/notifications.js'

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

  const clearRead = useCallback(() => {
    clearReadNotifications()
    setNotifications(prev => prev.filter(n => !n.read))
  }, [])

  const dismiss = useCallback((taskId, completedAt) => {
    dismissNotification(taskId, completedAt)
    setNotifications(prev => prev.filter(n => !(n.taskId === taskId && n.completedAt === completedAt)))
  }, [])

  const markRead = useCallback((taskId, completedAt) => {
    markNotificationRead(taskId, completedAt)
    setNotifications(prev => prev.map(n =>
      n.taskId === taskId && n.completedAt === completedAt ? { ...n, read: true } : n
    ))
  }, [])

  const markAllRead = useCallback(() => {
    markAllNotificationsRead()
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }, [])

  const unreadCount = notifications.filter(n => !n.read).length

  return { notifications, loading, refresh, clear, clearRead, dismiss, markRead, markAllRead, unreadCount }
}
