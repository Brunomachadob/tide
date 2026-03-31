#!/usr/bin/env node
// task-setup.js — reads task.json, initializes a run (creates run dir + run.json),
// and emits shell variable assignments for tide.sh
// Usage:
//   node task-setup.js <task-file>
import crypto from 'crypto'
import fs from 'fs'
import os from 'os'
import path from 'path'

const TIDE_DIR = path.join(os.homedir(), '.tide')
const [,, taskFile] = process.argv

const task = JSON.parse(fs.readFileSync(taskFile, 'utf8'))

let command = task.command || ''
let terminalBundleId = 'com.apple.Terminal'
try {
  const settings = JSON.parse(fs.readFileSync(path.join(TIDE_DIR, 'settings.json'), 'utf8'))
  if (!command) command = settings.command || ''
  if (settings.terminalBundleId) terminalBundleId = settings.terminalBundleId
} catch { /* no settings file */ }

// Initialize run
const runId = crypto.randomBytes(4).toString('hex')
const startedAt = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
const runDir = path.join(TIDE_DIR, 'tasks', task.id, 'runs', runId)
fs.mkdirSync(runDir, { recursive: true })
const runRecord = {
  runId,
  taskId: task.id,
  taskName: task.name,
  startedAt,
  argument: task.argument || '',
}
if (task.parentRunId) runRecord.parentRunId = task.parentRunId
fs.writeFileSync(path.join(runDir, 'run.json'), JSON.stringify(runRecord, null, 2))

const q = v => `'${String(v).replace(/'/g, "'\\''")}'`
console.log(`COMMAND=${q(command)}`)
console.log(`EXTRA_ARGS=${q((task.extraArgs || []).join(' '))}`)
console.log(`MAX_RETRIES=${q(task.maxRetries ?? 0)}`)
console.log(`TASK_NAME=${q(task.name || 'unnamed')}`)
console.log(`WORKING_DIR=${q(task.workingDirectory || os.homedir())}`)
console.log(`RESULT_RETENTION_DAYS=${q(task.resultRetentionDays ?? 30)}`)
console.log(`JITTER_SECONDS=${q(task.jitterSeconds ?? 0)}`)
console.log(`ARGUMENT=${q(task.argument || '')}`)
console.log(`TERMINAL_BUNDLE_ID=${q(terminalBundleId)}`)
console.log(`CLAUDE_STREAM_JSON=${q(task.claudeStreamJson ? '1' : '0')}`)
console.log(`RUN_ID=${q(runId)}`)
console.log(`RUN_DIR=${q(runDir)}`)
console.log(`STARTED_AT=${q(startedAt)}`)
