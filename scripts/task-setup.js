#!/usr/bin/env node
// task-setup.js — reads task.json and emits shell variable assignments for task-runner.sh
// Usage:
//   node task-setup.js <task-file>
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
