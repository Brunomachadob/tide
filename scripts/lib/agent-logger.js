// Logging utilities for agent-runner.js.
// Maintains mutable module-level state for the current log file paths and prefix.
// Call configureLogger() once per run to wire up file output.
import fs from 'fs'

/** ISO timestamp without milliseconds: "2024-01-01T12:00:00Z" */
export function now() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
}

/** Promise-based sleep. */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Mutable state — set by configureLogger()
let _outputLog = null
let _stderrLog = null
let _logPrefix = ''

/**
 * Configure log destinations. Call once with just `prefix` before the run dir exists,
 * and again with all three paths after the run dir is created.
 * Pass null for paths to disable file output for that stream.
 */
export function configureLogger({ outputLog = null, stderrLog = null, prefix = '' } = {}) {
  _outputLog = outputLog
  _stderrLog = stderrLog
  _logPrefix = prefix
}

/** Write a timestamped line to stdout and, if configured, append to output.log. */
export function log(msg) {
  const line = `[${now()}]${_logPrefix} ${msg}`
  process.stdout.write(line + '\n')
  if (_outputLog) try { fs.appendFileSync(_outputLog, line + '\n') } catch { /* ok */ }
}

/** Write a timestamped line to stdout and, if configured, append to stderr.log. */
export function logError(msg) {
  const line = `[${now()}]${_logPrefix} ${msg}`
  process.stdout.write(line + '\n')
  if (_stderrLog) try { fs.appendFileSync(_stderrLog, line + '\n') } catch { /* ok */ }
}

/**
 * Rotate a log file in place if it exceeds 5 MB, keeping the last 2 MB.
 * Prepends a '[... rotated ...]\n' marker.
 */
export function rotateLog(logFile) {
  const MAX = 5 * 1024 * 1024
  const KEEP = 2 * 1024 * 1024
  try {
    const stat = fs.statSync(logFile)
    if (stat.size > MAX) {
      const buf = fs.readFileSync(logFile)
      const trimmed = buf.subarray(buf.length - KEEP)
      fs.writeFileSync(logFile, Buffer.concat([Buffer.from('[... rotated ...]\n'), trimmed]))
    }
  } catch { /* ok */ }
}
