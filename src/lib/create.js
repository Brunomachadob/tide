// create a new scheduled task: write tide: fields to .md, generate plist, register with launchd
import fs from 'fs'
import os from 'os'
import path from 'path'
import crypto from 'crypto'
import { spawnSync } from 'child_process'
import { fileURLToPath } from 'url'
import { bootstrap, plistPath, label } from './launchd.js'

function taskDir(id) {
  return path.join(os.homedir(), '.tide', 'tasks', id)
}
import { writeTideFields } from './mdfields.js'

const PLUGIN_ROOT = path.resolve(fileURLToPath(import.meta.url), '../../..')

function generateId() {
  return crypto.randomBytes(4).toString('hex')
}

function xmlEscape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function buildScheduleXml(schedule) {
  if (!schedule || schedule.type === 'manual') return ''
  const secs = schedule.intervalSeconds || 3600
  return `  <key>StartInterval</key>\n  <integer>${secs}</integer>`
}

function buildEnvXml(env) {
  if (!env || !Object.keys(env).length) return ''
  return Object.entries(env).map(([k, v]) => `    <key>${xmlEscape(k)}</key>\n    <string>${xmlEscape(v)}</string>`).join('\n')
}

function generatePlist(taskId, config) {
  const taskLabel = label(taskId)
  const tDir = taskDir(taskId)
  const logStdout = path.join(tDir, 'logs', 'stdout.log')
  const logStderr = path.join(tDir, 'logs', 'stderr.log')
  const runner = path.join(PLUGIN_ROOT, 'scripts', 'tide.sh')
  const workDir = config.workingDirectory || os.homedir()
  const extraEnv = buildEnvXml(config.env)

  const effectiveTimeout = config.timeoutSeconds
    ? config.timeoutSeconds + (config.jitterSeconds ?? 0)
    : null
  const timeoutXml = effectiveTimeout
    ? `  <key>TimeOut</key>\n  <integer>${effectiveTimeout}</integer>`
    : ''

  const tideTaskFileXml = config.sourcePath
    ? `    <key>TIDE_TASK_FILE</key>\n    <string>${xmlEscape(config.sourcePath)}</string>\n`
    : ''

  const agent = config.profile?.agent || 'claude-code'
  const tideAgentXml = `    <key>TIDE_AGENT</key>\n    <string>${xmlEscape(agent)}</string>\n`

  const disabledXml = config.enabled === false
    ? '  <key>Disabled</key>\n  <true/>\n'
    : ''

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${xmlEscape(taskLabel)}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${xmlEscape(runner)}</string>
    <string>${xmlEscape(taskId)}</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>TIDE_TASK_ID</key>
    <string>${xmlEscape(taskId)}</string>
${tideTaskFileXml}${tideAgentXml}    <key>HOME</key>
    <string>${xmlEscape(os.homedir())}</string>
    <key>PATH</key>
    <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
${extraEnv}  </dict>
${buildScheduleXml(config.schedule)}
${timeoutXml}
  <key>StandardOutPath</key>
  <string>${xmlEscape(logStdout)}</string>
  <key>StandardErrorPath</key>
  <string>${xmlEscape(logStderr)}</string>
  <key>RunAtLoad</key>
  <false/>
${disabledXml}  <key>WorkingDirectory</key>
  <string>${xmlEscape(workDir)}</string>
</dict>
</plist>
`
}

export function writePlist(taskId, config) {
  const plist = plistPath(taskId)
  fs.writeFileSync(plist, generatePlist(taskId, config))
  const lint = spawnSync('plutil', ['-lint', plist], { encoding: 'utf8' })
  if (lint.status !== 0) {
    fs.unlinkSync(plist)
    throw new Error(`Generated plist is invalid: ${lint.stdout || lint.stderr}`)
  }
  return plist
}

/**
 * Create a new task.
 * config: { name, argument, schedule, workingDirectory, env, profile,
 *           resultRetentionDays, timeoutSeconds, parentRunId?, id?, createdAt? }
 * Returns the created task object.
 */
export function createTask(config) {
  if (!config.name) throw new Error("'name' is required")
  if (!config.argument) throw new Error("'argument' is required")

  const taskId = config.id || generateId()
  const createdAt = config.createdAt || new Date().toISOString().replace(/\.\d+Z$/, 'Z')
  const workingDirectory = config.workingDirectory || os.homedir()
  const schedule = config.schedule || { type: 'interval', intervalSeconds: 3600 }
  const isManual = schedule.type === 'manual'
  const intervalSeconds = isManual ? 0 : (schedule.intervalSeconds || 3600)
  const jitterSeconds = config.jitterSeconds ?? (isManual ? 0 : Math.floor(Math.random() * Math.min(intervalSeconds / 4, 300)))
  const timeoutSeconds = config.timeoutSeconds ?? null
  const resultRetentionDays = config.resultRetentionDays ?? 30

  const tDir = taskDir(taskId)
  fs.mkdirSync(path.join(tDir, 'logs'), { recursive: true })
  if (config.sourcePath) {
    fs.writeFileSync(path.join(tDir, 'source.txt'), config.sourcePath, 'utf8')
  }

  const task = {
    id: taskId,
    name: config.name,
    argument: config.argument,
    schedule,
    jitterSeconds,
    createdAt,
    enabled: true,
    workingDirectory,
    env: config.env || {},
    ...(config.profile ? { profile: config.profile } : {}),
    ...(timeoutSeconds !== null && { timeoutSeconds }),
    resultRetentionDays,
    sourcePath: config.sourcePath || null,
    ...(config.parentRunId ? { parentRunId: config.parentRunId } : {}),
  }

  // Write internal fields back to the source .md file
  if (config.sourcePath) {
    writeTideFields(config.sourcePath, {
      '_id': taskId,
      '_createdAt': createdAt,
      '_jitter': jitterSeconds,
      '_enabled': true,
    })
  }

  const plist = writePlist(taskId, task)
  bootstrap(taskId)

  return { task, plistPath: plist }
}

/**
 * Update an existing task's editable fields and re-register with launchd.
 * Preserves id, createdAt, jitterSeconds, enabled.
 */
export function updateTask(existing, changes) {
  const schedule = changes.schedule || existing.schedule
  const workingDirectory = changes.workingDirectory || existing.workingDirectory

  const task = {
    ...existing,
    name: changes.name ?? existing.name,
    argument: changes.argument ?? existing.argument,
    schedule,
    workingDirectory,
  }

  if (task.sourcePath) {
    writeTideFields(task.sourcePath, { '_enabled': task.enabled })
  }
  writePlist(task.id, task)
  if (task.enabled) bootstrap(task.id)

  return task
}
