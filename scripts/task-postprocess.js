#!/usr/bin/env node
// task-postprocess.js — completes run.json, writes notification, rotates logs, prunes old runs
// Usage:
//   node task-postprocess.js <task-file> <exit-code> <started-at> <completed-at> <attempts> <run-dir>
import fs from 'fs'
import os from 'os'
import path from 'path'

const TIDE_DIR = path.join(os.homedir(), '.tide')
const [,, taskFile, exitCodeStr, startedAt, completedAt, attemptsStr, runDir] = process.argv

const task = JSON.parse(fs.readFileSync(taskFile, 'utf8'))
const exitCode = parseInt(exitCodeStr)
const attempts = parseInt(attemptsStr)
const retentionDays = task.resultRetentionDays ?? 30

// Read runId from the initial run.json written by task-setup.js
const runFile = path.join(runDir, 'run.json')
let runId = path.basename(runDir)
try {
  const existing = JSON.parse(fs.readFileSync(runFile, 'utf8'))
  runId = existing.runId ?? runId
} catch { /* use dirname as fallback */ }

const outputLog = path.join(runDir, 'output.log')
const stderrLog = path.join(runDir, 'stderr.log')

// Read last 300 chars of output log for notification summary
let output = ''
try {
  const buf = fs.readFileSync(outputLog, 'utf8')
  output = buf.slice(-300)
} catch { /* ok */ }

// Complete run.json (overwrite with full record)
fs.writeFileSync(runFile, JSON.stringify({
  runId,
  taskId: task.id,
  taskName: task.name,
  startedAt,
  completedAt,
  exitCode,
  attempts,
}, null, 2))

// Append notification (atomic)
const notifFile = path.join(TIDE_DIR, 'notifications.json')
let entries = []
try { entries = JSON.parse(fs.readFileSync(notifFile, 'utf8')) } catch { /* ok */ }
entries.push({
  taskId: task.id,
  taskName: task.name,
  completedAt,
  exitCode,
  resultFile: runFile,
  summary: output.slice(0, 300),
  read: false,
})
const tmp = notifFile + '.tmp'
fs.writeFileSync(tmp, JSON.stringify(entries, null, 2))
fs.renameSync(tmp, notifFile)

// Log rotation: cap at 5MB, keep last 2MB
const MAX = 5 * 1024 * 1024
const KEEP = 2 * 1024 * 1024
for (const logFile of [outputLog, stderrLog]) {
  try {
    const stat = fs.statSync(logFile)
    if (stat.size > MAX) {
      const buf = fs.readFileSync(logFile)
      const trimmed = buf.subarray(buf.length - KEEP)
      fs.writeFileSync(logFile, Buffer.concat([Buffer.from('[... rotated ...]\n'), trimmed]))
    }
  } catch { /* ok */ }
}

// Run retention: delete run directories older than retentionDays
const runsDir = path.join(TIDE_DIR, 'tasks', task.id, 'runs')
const cutoff = Date.now() - retentionDays * 86400 * 1000
try {
  for (const entry of fs.readdirSync(runsDir)) {
    const entryPath = path.join(runsDir, entry)
    try {
      const entryRunFile = path.join(entryPath, 'run.json')
      const entryRun = JSON.parse(fs.readFileSync(entryRunFile, 'utf8'))
      if (entryRun.startedAt && new Date(entryRun.startedAt).getTime() < cutoff) {
        fs.rmSync(entryPath, { recursive: true, force: true })
      }
    } catch { /* skip unreadable entries */ }
  }
} catch { /* ok if runs dir missing */ }
