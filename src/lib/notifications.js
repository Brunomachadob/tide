// read/write notifications.json
import os from 'os'
import path from 'path'
import { safeReadJSON, atomicWriteJSON } from './io.js'

const NOTIFICATIONS_FILE = path.join(os.homedir(), '.tide', 'notifications.json')

export function getNotifications() {
  return safeReadJSON(NOTIFICATIONS_FILE, [])
}

export function clearNotifications() {
  atomicWriteJSON(NOTIFICATIONS_FILE, [])
}

export function clearReadNotifications() {
  const current = safeReadJSON(NOTIFICATIONS_FILE, [])
  atomicWriteJSON(NOTIFICATIONS_FILE, current.filter(n => !n.read))
}

export function dismissNotification(taskId, completedAt) {
  const current = safeReadJSON(NOTIFICATIONS_FILE, [])
  atomicWriteJSON(NOTIFICATIONS_FILE, current.filter(n => !(n.taskId === taskId && n.completedAt === completedAt)))
}

export function markNotificationRead(taskId, completedAt) {
  const current = safeReadJSON(NOTIFICATIONS_FILE, [])
  atomicWriteJSON(NOTIFICATIONS_FILE, current.map(n =>
    n.taskId === taskId && n.completedAt === completedAt ? { ...n, read: true } : n
  ))
}

export function markAllNotificationsRead() {
  const current = safeReadJSON(NOTIFICATIONS_FILE, [])
  atomicWriteJSON(NOTIFICATIONS_FILE, current.map(n => ({ ...n, read: true })))
}
