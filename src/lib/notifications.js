// read/clear pending-notifications.json
import os from 'os'
import path from 'path'
import { safeReadJSON, atomicWriteJSON } from './io.js'

const NOTIFICATIONS_FILE = path.join(os.homedir(), '.tide', 'pending-notifications.json')

export function getNotifications() {
  return safeReadJSON(NOTIFICATIONS_FILE, [])
}

export function clearNotifications() {
  atomicWriteJSON(NOTIFICATIONS_FILE, [])
}
