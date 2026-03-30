import { createRequire } from 'module'
import os from 'os'
import path from 'path'

const require = createRequire(import.meta.url)
const fs = require('fs')
const { spawnSync } = require('child_process')

export const SETTINGS_FILE = path.join(os.homedir(), '.claude', 'scheduler', 'tui-settings.json')

export function detectClaudeCommand() {
  for (const name of ['claude', 'claude26']) {
    const r = spawnSync('which', [name], { encoding: 'utf8' })
    if (r.status === 0 && r.stdout.trim()) return r.stdout.trim()
  }
  return ''
}

const DEFAULTS = {
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  dateFormat: 'YYYY-MM-DD',
  command: '',
  defaultWorkingDirectory: os.homedir(),
}

export function readSettings() {
  if (!fs.existsSync(SETTINGS_FILE)) return { ...DEFAULTS }
  try {
    return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')) }
  } catch {
    return { ...DEFAULTS }
  }
}

export function writeSettings(settings) {
  const tmp = SETTINGS_FILE + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(settings, null, 2))
  fs.renameSync(tmp, SETTINGS_FILE)
}

export function formatDate(isoString, settings) {
  if (!isoString) return 'never'
  const s = settings || readSettings()
  const d = new Date(isoString)
  const pad = n => String(n).padStart(2, '0')
  const year = d.getFullYear()
  const month = pad(d.getMonth() + 1)
  const day = pad(d.getDate())
  const hours = pad(d.getHours())
  const mins = pad(d.getMinutes())
  let datePart
  if (s.dateFormat === 'DD.MM.YYYY') {
    datePart = `${day}.${month}.${year}`
  } else if (s.dateFormat === 'MM/DD/YYYY') {
    datePart = `${month}/${day}/${year}`
  } else {
    datePart = `${year}-${month}-${day}`
  }
  return `${datePart} ${hours}:${mins}`
}
