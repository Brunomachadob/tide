#!/usr/bin/env node
// task-setup.js — reads the .md task file, initializes a run (creates run dir + run.json),
// and emits shell variable assignments for tide.sh
// Usage:
//   node task-setup.js <task-file.md>
import crypto from 'crypto'
import fs from 'fs'
import os from 'os'
import path from 'path'
import matter from 'gray-matter'

const TIDE_DIR = path.join(os.homedir(), '.tide')
const [,, taskFile] = process.argv

const SCHEDULE_SHORTHANDS = {
  manual: null, '15m': 900, '30m': 1800, '1h': 3600,
  '2h': 7200, '6h': 21600, '12h': 43200, '24h': 86400,
}

// Parse the .md file
const raw = fs.readFileSync(taskFile, 'utf8')
const { data: fm, content: body } = matter(raw)

const taskId = fm['_id']
if (!taskId) throw new Error(`No _id in task file: ${taskFile}`)

let command = fm.command || ''
let terminalBundleId = 'com.apple.Terminal'
try {
  const settings = JSON.parse(fs.readFileSync(path.join(TIDE_DIR, 'settings.json'), 'utf8'))
  if (!command) command = settings.command || ''
  if (settings.terminalBundleId) terminalBundleId = settings.terminalBundleId
} catch { /* no settings file */ }

const jitterSeconds = fm['_jitter'] ?? 0
const argument = body.trim()

// Initialize run
const runId = crypto.randomBytes(4).toString('hex')
const startedAt = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
const runDir = path.join(TIDE_DIR, 'tasks', taskId, 'runs', runId)
fs.mkdirSync(runDir, { recursive: true })
const runRecord = {
  runId,
  taskId,
  taskName: fm.name || path.basename(taskFile, '.md'),
  startedAt,
  argument,
}
if (fm.parentRunId) runRecord.parentRunId = fm.parentRunId
fs.writeFileSync(path.join(runDir, 'run.json'), JSON.stringify(runRecord, null, 2))

const q = v => `'${String(v).replace(/'/g, "'\\''")}'`
console.log(`COMMAND=${q(command)}`)
console.log(`EXTRA_ARGS=${q((fm.extraArgs || []).join(' '))}`)
console.log(`MAX_RETRIES=${q(fm.maxRetries ?? 0)}`)
console.log(`TASK_NAME=${q(fm.name || path.basename(taskFile, '.md'))}`)
console.log(`WORKING_DIR=${q(fm.workingDirectory ? fm.workingDirectory.replace(/^~/, os.homedir()) : os.homedir())}`)
console.log(`RESULT_RETENTION_DAYS=${q(fm.resultRetentionDays ?? 30)}`)
console.log(`JITTER_SECONDS=${q(jitterSeconds)}`)
console.log(`ARGUMENT=${q(argument)}`)
console.log(`TERMINAL_BUNDLE_ID=${q(terminalBundleId)}`)
console.log(`CLAUDE_STREAM_JSON=${q(fm.claudeStreamJson ? '1' : '0')}`)
console.log(`RUN_ID=${q(runId)}`)
console.log(`RUN_DIR=${q(runDir)}`)
console.log(`STARTED_AT=${q(startedAt)}`)
