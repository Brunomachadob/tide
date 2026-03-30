// read/clear pending-notifications.json
import fs from 'fs'
import path from 'path'
import os from 'os'

const NOTIFICATIONS_FILE = path.join(os.homedir(), '.tide', 'pending-notifications.json')

export function getNotifications() {
  if (!fs.existsSync(NOTIFICATIONS_FILE)) return []
  try {
    return JSON.parse(fs.readFileSync(NOTIFICATIONS_FILE, 'utf8'))
  } catch {
    return []
  }
}

export function clearNotifications() {
  const tmp = NOTIFICATIONS_FILE + '.tmp'
  fs.writeFileSync(tmp, '[]')
  fs.renameSync(tmp, NOTIFICATIONS_FILE)
}
