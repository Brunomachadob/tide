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

const dateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'short', timeStyle: 'short' })

/** Format an ISO timestamp using the system locale and timezone. */
export function formatDate(isoString) {
  if (!isoString) return 'never'
  return dateFormatter.format(new Date(isoString))
}

/** Format a schedule object for display (e.g. "every 2h"). */
export function formatSchedule(schedule) {
  if (!schedule) return 'unknown'
  if (schedule.type === 'manual') return 'manual'
  const secs = schedule.intervalSeconds || schedule.seconds || 3600
  if (secs < 60) return `every ${secs}s`
  if (secs < 3600) return `every ${Math.floor(secs / 60)}m`
  if (secs >= 86400 && secs % 86400 === 0) return `every ${Math.floor(secs / 86400)}d`
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  return `every ${h}h` + (m ? ` ${m}m` : '')
}
