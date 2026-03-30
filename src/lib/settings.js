import fs from 'fs'
import os from 'os'
import path from 'path'
export const SETTINGS_FILE = path.join(os.homedir(), '.tide', 'settings.json')


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
