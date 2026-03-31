#!/usr/bin/env node
// task-postprocess.js — writes result JSON, notifications, rotates logs, and prunes old results
// Usage:
//   node task-postprocess.js <task-file> <exit-code> <started-at> <completed-at> <attempts> <output> <output-log> <stderr-log>
import fs from 'fs'
import os from 'os'
import path from 'path'

const TIDE_DIR = path.join(os.homedir(), '.tide')
const [,, taskFile, exitCodeStr, startedAt, completedAt, attemptsStr, outputLog, stderrLog] = process.argv

const task = JSON.parse(fs.readFileSync(taskFile, 'utf8'))
const exitCode = parseInt(exitCodeStr)
const attempts = parseInt(attemptsStr)
const retentionDays = task.resultRetentionDays ?? 30

// Read last 300 chars of output log for notification summary
let output = ''
try {
  const buf = fs.readFileSync(outputLog, 'utf8')
  output = buf.slice(-300)
} catch { /* ok */ }

// Write result JSON
const resultsDir = path.join(TIDE_DIR, 'tasks', task.id, 'results')
const resultFile = path.join(resultsDir, `${startedAt}.json`)
fs.writeFileSync(resultFile, JSON.stringify({
  taskId: task.id,
  taskName: task.name,
  startedAt,
  completedAt,
  exitCode,
  attempts,
  output,
}, null, 2))

// Append notification (atomic)
const notifFile = path.join(TIDE_DIR, 'pending-notifications.json')
let entries = []
try { entries = JSON.parse(fs.readFileSync(notifFile, 'utf8')) } catch { /* ok */ }
entries.push({
  taskId: task.id,
  taskName: task.name,
  completedAt,
  exitCode,
  resultFile,
  summary: output.slice(0, 300),
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

// Result retention: delete result files older than retentionDays
const cutoff = Date.now() - retentionDays * 86400 * 1000
for (const fname of fs.readdirSync(resultsDir)) {
  if (!fname.endsWith('.json')) continue
  const fpath = path.join(resultsDir, fname)
  try {
    if (fs.statSync(fpath).mtimeMs < cutoff) fs.unlinkSync(fpath)
  } catch { /* ok */ }
}
