import os from 'os'
import path from 'path'

export const LAUNCH_AGENTS_DIR = path.join(os.homedir(), 'Library', 'LaunchAgents')


export const SCHEDULE_SHORTHANDS = {
  manual: null,
  '15m':  15 * 60,
  '30m':  30 * 60,
  '1h':   60 * 60,
  '2h':   2  * 60 * 60,
  '6h':   6  * 60 * 60,
  '12h':  12 * 60 * 60,
  '24h':  24 * 60 * 60,
}

/** Parse a schedule shorthand string into { type, intervalSeconds }. */
export function parseSchedule(value) {
  if (!value || value === 'manual') return { type: 'manual' }
  const seconds = SCHEDULE_SHORTHANDS[String(value)]
  if (seconds != null) return { type: 'interval', intervalSeconds: seconds }
  const n = parseInt(value)
  if (!isNaN(n) && n > 0) return { type: 'interval', intervalSeconds: n }
  return { type: 'manual' }
}

