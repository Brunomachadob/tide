// read/write notifications spool directory (~/.tide/notifications/<runId>.json)
import fs from 'fs'
import os from 'os'
import path from 'path'
import { safeReadJSON, atomicWriteJSON } from './io.js'

const NOTIF_DIR = path.join(os.homedir(), '.tide', 'notifications')

function notifPath(runId) {
  return path.join(NOTIF_DIR, `${runId}.json`)
}

function readAllNotifications() {
  let entries
  try {
    entries = fs.readdirSync(NOTIF_DIR).filter(f => f.endsWith('.json') && !f.endsWith('.tmp'))
  } catch {
    return []
  }
  const results = []
  for (const file of entries) {
    const n = safeReadJSON(path.join(NOTIF_DIR, file))
    if (n) results.push(n)
  }
  results.sort((a, b) => {
    if (!a.completedAt) return 1
    if (!b.completedAt) return -1
    return a.completedAt < b.completedAt ? -1 : a.completedAt > b.completedAt ? 1 : 0
  })
  return results
}

export function getNotifications() {
  return readAllNotifications()
}

export function clearNotifications() {
  let entries
  try {
    entries = fs.readdirSync(NOTIF_DIR).filter(f => f.endsWith('.json') && !f.endsWith('.tmp'))
  } catch {
    return
  }
  for (const file of entries) {
    try { fs.unlinkSync(path.join(NOTIF_DIR, file)) } catch { /* ok */ }
  }
}

export function clearReadNotifications() {
  const all = readAllNotifications()
  for (const n of all) {
    if (n.read) {
      try { fs.unlinkSync(notifPath(n.runId)) } catch { /* ok */ }
    }
  }
}

export function dismissNotification(taskId, completedAt) {
  const all = readAllNotifications()
  for (const n of all) {
    if (n.taskId === taskId && n.completedAt === completedAt) {
      try { fs.unlinkSync(notifPath(n.runId)) } catch { /* ok */ }
    }
  }
}

export function markNotificationRead(taskId, completedAt) {
  const all = readAllNotifications()
  for (const n of all) {
    if (n.taskId === taskId && n.completedAt === completedAt && !n.read) {
      atomicWriteJSON(notifPath(n.runId), { ...n, read: true })
    }
  }
}

export function markAllNotificationsRead() {
  const all = readAllNotifications()
  for (const n of all) {
    if (!n.read) {
      atomicWriteJSON(notifPath(n.runId), { ...n, read: true })
    }
  }
}
