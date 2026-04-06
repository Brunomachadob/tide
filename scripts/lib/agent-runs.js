// Run lifecycle writers for agent-runner.js.
// Handles init/complete of run.json, notification spooling, and run retention pruning.
// All functions take tideDir explicitly so they are testable without HOME override.
import fs from 'fs'
import path from 'path'
import { atomicWriteJSON } from '../../src/lib/io.js'

/**
 * Create the run directory and write the initial run.json.
 * Returns { runDir, runFile, outputLog, stderrLog }.
 */
export function initRun(tideDir, taskId, taskName, runId, startedAt, argument, parentRunId) {
  const runDir = path.join(tideDir, 'tasks', taskId, 'runs', runId)
  fs.mkdirSync(runDir, { recursive: true })

  const runFile = path.join(runDir, 'run.json')
  const outputLog = path.join(runDir, 'output.log')
  const stderrLog = path.join(runDir, 'stderr.log')

  const record = { runId, taskId, taskName, startedAt, argument }
  if (parentRunId) record.parentRunId = parentRunId
  atomicWriteJSON(runFile, record)

  return { runDir, runFile, outputLog, stderrLog }
}

/**
 * Overwrite run.json with the completed record.
 */
export function completeRun(runFile, { runId, taskId, taskName, startedAt, completedAt, exitCode, attempts, argument, parentRunId }) {
  const record = { runId, taskId, taskName, startedAt, completedAt, exitCode, attempts, argument }
  if (parentRunId) record.parentRunId = parentRunId
  atomicWriteJSON(runFile, record)
}

/**
 * Write a notification spool file to <tideDir>/notifications/<runId>.json.
 * Reads the last 300 bytes of outputLog as the summary (empty string if file missing).
 */
export function spoolNotification(tideDir, { taskId, taskName, runId, completedAt, exitCode, runFile, outputLog }) {
  let summary = ''
  try {
    const buf = fs.readFileSync(outputLog, 'utf8')
    summary = buf.slice(-300)
  } catch { /* ok */ }

  const notifDir = path.join(tideDir, 'notifications')
  fs.mkdirSync(notifDir, { recursive: true })
  atomicWriteJSON(path.join(notifDir, `${runId}.json`), {
    taskId, taskName, runId, completedAt, exitCode,
    resultFile: runFile,
    summary: summary.slice(0, 300),
    read: false,
  })
}

/**
 * Delete run directories for taskId older than retentionDays.
 */
export function pruneOldRuns(tideDir, taskId, retentionDays) {
  const runsDir = path.join(tideDir, 'tasks', taskId, 'runs')
  const cutoff = Date.now() - retentionDays * 86400 * 1000
  try {
    for (const entry of fs.readdirSync(runsDir)) {
      const entryPath = path.join(runsDir, entry)
      try {
        const run = JSON.parse(fs.readFileSync(path.join(entryPath, 'run.json'), 'utf8'))
        if (run.startedAt && new Date(run.startedAt).getTime() < cutoff) {
          fs.rmSync(entryPath, { recursive: true, force: true })
        }
      } catch { /* skip */ }
    }
  } catch { /* ok */ }
}
