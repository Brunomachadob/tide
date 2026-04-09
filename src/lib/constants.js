import os from 'os'
import path from 'path'

export const LAUNCH_AGENTS_DIR = path.join(os.homedir(), 'Library', 'LaunchAgents')


/** Parse a schedule string into { type, intervalSeconds }.
 *
 * Accepted formats:
 *   Nm   — N minutes  (e.g. 15m, 90m)
 *   Nh   — N hours    (e.g. 1h, 12h)
 *   Nd   — N days     (e.g. 1d, 30d)
 *   N    — N seconds  (plain integer)
 *   manual (or omitted) — no automatic schedule
 */
export function parseSchedule(value) {
  if (!value || value === 'manual') return { type: 'manual' }
  const str = String(value).trim()
  const match = str.match(/^(\d+)(m|h|d)?$/)
  if (!match) return { type: 'manual' }
  const n = parseInt(match[1])
  if (n <= 0) return { type: 'manual' }
  const unit = match[2]
  const multipliers = { m: 60, h: 3600, d: 86400 }
  const intervalSeconds = n * (multipliers[unit] ?? 1)
  return { type: 'interval', intervalSeconds }
}

