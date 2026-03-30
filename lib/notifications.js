// lib/notifications.js — read/clear pending-notifications.json
'use strict'

const fs = require('fs')
const path = require('path')
const os = require('os')

const NOTIFICATIONS_FILE = path.join(os.homedir(), '.claude', 'scheduler', 'pending-notifications.json')

function getNotifications() {
  if (!fs.existsSync(NOTIFICATIONS_FILE)) return []
  try {
    return JSON.parse(fs.readFileSync(NOTIFICATIONS_FILE, 'utf8'))
  } catch {
    return []
  }
}

function clearNotifications() {
  const tmp = NOTIFICATIONS_FILE + '.tmp'
  fs.writeFileSync(tmp, '[]')
  fs.renameSync(tmp, NOTIFICATIONS_FILE)
}

module.exports = { getNotifications, clearNotifications }
