// create a new scheduled task: write prompt, generate plist, register with launchd
import fs from 'fs'
import os from 'os'
import path from 'path'
import crypto from 'crypto'
import { spawnSync } from 'child_process'
import { fileURLToPath } from 'url'
import { writeTask, taskDir } from './tasks.js'
import { bootstrap, plistPath, label } from './launchd.js'
import { readSettings } from './settings.js'

const PLUGIN_ROOT = path.resolve(fileURLToPath(import.meta.url), '../../..')
const LAUNCH_AGENTS_DIR = path.join(os.homedir(), 'Library', 'LaunchAgents')

function generateId() {
  return crypto.randomBytes(4).toString('hex')
}

function buildScheduleXml(schedule) {
  if (schedule.type === 'interval') {
    const secs = schedule.intervalSeconds || 3600
    return `  <key>StartInterval</key>\n  <integer>${secs}</integer>`
  }
  const hour = schedule.hour ?? 9
  const minute = schedule.minute ?? 0
  const days = schedule.days
  if (days && days.length) {
    return days.map(day =>
      `  <key>StartCalendarInterval</key>\n  <dict>\n    <key>Weekday</key><integer>${day}</integer>\n    <key>Hour</key><integer>${hour}</integer>\n    <key>Minute</key><integer>${minute}</integer>\n  </dict>`
    ).join('\n')
  }
  return `  <key>StartCalendarInterval</key>\n  <dict>\n    <key>Hour</key><integer>${hour}</integer>\n    <key>Minute</key><integer>${minute}</integer>\n  </dict>`
}

function buildEnvXml(env) {
  if (!env || !Object.keys(env).length) return ''
  return Object.entries(env).map(([k, v]) => `    <key>${k}</key>\n    <string>${v}</string>`).join('\n')
}

function generatePlist(taskId, config) {
  const taskLabel = label(taskId)
  const tDir = taskDir(taskId)
  const logStdout = path.join(tDir, 'logs', 'stdout.log')
  const logStderr = path.join(tDir, 'logs', 'stderr.log')
  const runner = path.join(PLUGIN_ROOT, 'scripts', 'task-runner.sh')
  const workDir = config.workingDirectory || os.homedir()
  const extraEnv = buildEnvXml(config.env)

  const timeoutXml = config.timeoutSeconds
    ? `  <key>TimeOut</key>\n  <integer>${config.timeoutSeconds}</integer>`
    : ''

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${taskLabel}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${runner}</string>
    <string>${taskId}</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>TIDE_TASK_ID</key>
    <string>${taskId}</string>
    <key>HOME</key>
    <string>${os.homedir()}</string>
    <key>PATH</key>
    <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
${extraEnv}  </dict>
${buildScheduleXml(config.schedule)}
${timeoutXml}
  <key>StandardOutPath</key>
  <string>${logStdout}</string>
  <key>StandardErrorPath</key>
  <string>${logStderr}</string>
  <key>RunAtLoad</key>
  <false/>
  <key>WorkingDirectory</key>
  <string>${workDir}</string>
</dict>
</plist>
`
}

/**
 * Create a new task.
 * config: { name, prompt, schedule, command, extraArgs, workingDirectory,
 *           maxRetries, permissionMode, env, id?, createdAt? }
 * Returns the created task object.
 */
export function createTask(config) {
  if (!config.name) throw new Error("'name' is required")
  if (!config.prompt) throw new Error("'prompt' is required")

  const taskId = config.id || generateId()
  const createdAt = config.createdAt || new Date().toISOString().replace(/\.\d+Z$/, 'Z')
  const command = config.command || readSettings().command
  const workingDirectory = config.workingDirectory || os.homedir()
  const maxRetries = config.maxRetries ?? 0
  const schedule = config.schedule || { type: 'calendar', hour: 9, minute: 0 }
  const timeoutSeconds = config.timeoutSeconds ?? null
  const resultRetentionDays = config.resultRetentionDays ?? 30

  const tDir = taskDir(taskId)
  fs.mkdirSync(path.join(tDir, 'logs'), { recursive: true })
  fs.mkdirSync(path.join(tDir, 'results'), { recursive: true })

  const promptFile = path.join(tDir, 'prompt.txt')
  fs.writeFileSync(promptFile, config.prompt)

  const plist = plistPath(taskId)
  const plistContent = generatePlist(taskId, { ...config, command, workingDirectory, schedule })
  fs.writeFileSync(plist, plistContent)

  const lint = spawnSync('plutil', ['-lint', plist], { encoding: 'utf8' })
  if (lint.status !== 0) {
    fs.unlinkSync(plist)
    throw new Error(`Generated plist is invalid: ${lint.stdout || lint.stderr}`)
  }

  bootstrap(taskId)

  const task = {
    id: taskId,
    name: config.name,
    prompt: config.prompt,
    command,
    extraArgs: config.extraArgs || [],
    schedule,
    createdAt,
    enabled: true,
    maxRetries,
    workingDirectory,
    env: config.env || {},
    ...(timeoutSeconds !== null && { timeoutSeconds }),
    resultRetentionDays,
  }
  writeTask(task)

  return { task, plistPath: plist, promptFile }
}
