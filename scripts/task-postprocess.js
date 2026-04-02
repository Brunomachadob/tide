#!/usr/bin/env node
// task-postprocess.js — completes run.json, writes notification, rotates logs, prunes old runs
// Usage:
//   node task-postprocess.js <task-file.md> <exit-code> <started-at> <completed-at> <attempts> <run-dir>
import fs from 'fs'
import os from 'os'
import path from 'path'
import matter from 'gray-matter'

const TIDE_DIR = path.join(os.homedir(), '.tide')
const [,, taskFile, exitCodeStr, startedAt, completedAt, attemptsStr, runDir] = process.argv

const raw = fs.readFileSync(taskFile, 'utf8')
const { data: fm } = matter(raw)

const taskId = fm['_id']
const taskName = fm.name || path.basename(taskFile, '.md')
const retentionDays = fm.resultRetentionDays ?? 30
const exitCode = parseInt(exitCodeStr)
const attempts = parseInt(attemptsStr)

// Read initial run.json written by task-setup.js — preserve argument and parentRunId
const runFile = path.join(runDir, 'run.json')
let runId = path.basename(runDir)
let savedArgument
let savedParentRunId
try {
  const existing = JSON.parse(fs.readFileSync(runFile, 'utf8'))
  runId = existing.runId ?? runId
  savedArgument = existing.argument
  savedParentRunId = existing.parentRunId
} catch { /* use dirname as fallback */ }

const outputLog = path.join(runDir, 'output.log')
const stderrLog = path.join(runDir, 'stderr.log')

// Read last 300 chars of output log for notification summary
let output = ''
try {
  const buf = fs.readFileSync(outputLog, 'utf8')
  output = buf.slice(-300)
} catch { /* ok */ }

// Complete run.json (overwrite with full record, preserving argument and parentRunId)
const completedRecord = {
  runId,
  taskId,
  taskName,
  startedAt,
  completedAt,
  exitCode,
  attempts,
}
if (savedArgument !== undefined) completedRecord.argument = savedArgument
if (savedParentRunId !== undefined) completedRecord.parentRunId = savedParentRunId
fs.writeFileSync(runFile, JSON.stringify(completedRecord, null, 2))

// Write notification as a single file in the spool directory — naturally concurrent-safe,
// no read-modify-write race between simultaneous task completions.
const notifDir = path.join(TIDE_DIR, 'notifications')
fs.mkdirSync(notifDir, { recursive: true })
const notifFile = path.join(notifDir, `${runId}.json`)
const tmp = notifFile + '.tmp'
fs.writeFileSync(tmp, JSON.stringify({
  taskId,
  taskName,
  runId,
  completedAt,
  exitCode,
  resultFile: runFile,
  summary: output.slice(0, 300),
  read: false,
}, null, 2))
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
const runsDir = path.join(TIDE_DIR, 'tasks', taskId, 'runs')
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
