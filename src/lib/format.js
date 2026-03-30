import { readSettings } from './settings.js'

/** Format an ISO timestamp as a human-readable relative time (e.g. "2h ago"). */
export function formatRelativeTime(isoString) {
  if (!isoString) return 'never'
  const diffMs = Date.now() - new Date(isoString).getTime()
  if (diffMs < 0) return 'just now'
  const secs = Math.floor(diffMs / 1000)
  if (secs < 60) return `${secs}s ago`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(months / 12)}y ago`
}

/** Format an ISO timestamp using the user's date format setting. */
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

/** Format a schedule object for display (e.g. "every 2h", "Mon,Wed 09:00"). */
export function formatSchedule(schedule) {
  if (!schedule) return 'unknown'
  if (schedule.type === 'interval') {
    const secs = schedule.intervalSeconds || schedule.seconds || 3600
    if (secs < 60) return `every ${secs}s`
    if (secs < 3600) return `every ${Math.floor(secs / 60)}m`
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    return `every ${h}h` + (m ? ` ${m}m` : '')
  }
  const hour = schedule.hour ?? 9
  const minute = schedule.minute ?? 0
  const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
  const days = schedule.days || schedule.weekdays
  if (days && days.length) {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    return `${days.map(d => dayNames[d]).join(',')} ${timeStr}`
  }
  return `daily ${timeStr}`
}
