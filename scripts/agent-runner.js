#!/usr/bin/env node
// agent-runner.js — SDK-based task runner for agentRunner: true tasks.
// Invoked by tide.sh via: tsh aws --exec node -- agent-runner.js <taskId>
// AWS credentials and HTTPS_PROXY are already in process.env (injected by tsh).
// Owns the full run lifecycle: init → SDK query → postprocess.
import crypto from 'crypto'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { spawnSync } from 'child_process'
import { fileURLToPath } from 'url'
import matter from 'gray-matter'
import { query } from '@anthropic-ai/claude-agent-sdk'

const TIDE_DIR = path.join(os.homedir(), '.tide')
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))

// ─── Auth strategies ─────────────────────────────────────────────────────────
// Each strategy is an async function: (config, env) → sdkOptions (partial query Options)
// 'tsh-okta-bedrock': validates tsh-injected env vars, returns modelOverrides for Bedrock.

async function tshOktaBedrockStrategy(config, env) {
  const required = ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'HTTPS_PROXY']
  const missing = required.filter(k => !env[k])
  if (missing.length) {
    throw new Error(`tsh-okta-bedrock: missing env vars: ${missing.join(', ')}. Is tsh running?`)
  }
  const model = config.model
  if (!model) throw new Error('tsh-okta-bedrock: agentAuth.model is required')

  // Map the requested model ID to the Bedrock ARN.
  // We also map the Bedrock ARN to itself so it round-trips cleanly.
  const modelOverrides = { [model]: model }
  // If model looks like a Bedrock ARN, also map known Anthropic IDs → same ARN
  // so the SDK doesn't try to resolve them directly.
  if (model.startsWith('arn:')) {
    modelOverrides['claude-sonnet-4-6'] = model
    modelOverrides['claude-opus-4-6'] = model
    modelOverrides['claude-haiku-4-5'] = model
  }

  return {
    model,
    settings: { modelOverrides },
  }
}

const AUTH_STRATEGIES = {
  'tsh-okta-bedrock': tshOktaBedrockStrategy,
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function now() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
}

function taskDir(taskId) {
  return path.join(TIDE_DIR, 'tasks', taskId)
}

function readSettings() {
  try {
    return JSON.parse(fs.readFileSync(path.join(TIDE_DIR, 'settings.json'), 'utf8'))
  } catch { return {} }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Rotate log file: if > MAX bytes, keep last KEEP bytes with a header.
function rotateLog(logFile) {
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

// Delete run directories older than retentionDays.
function pruneOldRuns(taskId, retentionDays) {
  const runsDir = path.join(taskDir(taskId), 'runs')
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

function sendNotification(title, message, terminalBundleId) {
  if (process.env.TIDE_NO_NOTIFY === '1') return
  if (spawnSync('which', ['terminal-notifier'], { encoding: 'utf8' }).status === 0) {
    spawnSync('terminal-notifier', ['-title', title, '-message', message, '-activate', terminalBundleId || 'com.apple.Terminal'])
  } else {
    spawnSync('osascript', ['-e', `display notification "${message}" with title "${title}"`])
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const taskId = process.argv[2]
if (!taskId) {
  console.error('Usage: agent-runner.js <taskId>')
  process.exit(1)
}

const taskFile = process.env.TIDE_TASK_FILE
if (!taskFile || !fs.existsSync(taskFile)) {
  console.error(`agent-runner: TIDE_TASK_FILE not set or not found: ${taskFile}`)
  process.exit(1)
}

const raw = fs.readFileSync(taskFile, 'utf8')
const { data: fm, content: body } = matter(raw)
const settings = readSettings()

const taskName = fm.name || path.basename(taskFile, '.md')
const argument = process.env.TIDE_OVERRIDE_ARGUMENT ?? body.trim()
const workingDirectory = fm.workingDirectory
  ? fm.workingDirectory.replace(/^~/, os.homedir())
  : (settings.defaultWorkingDirectory || os.homedir())
const jitterSeconds = fm['_jitter'] ?? 0
const maxRetries = fm.maxRetries ?? 0
const resultRetentionDays = fm.resultRetentionDays ?? 30
const parentRunId = process.env.TIDE_PARENT_RUN_ID || fm.parentRunId || undefined

// Resolve agentAuth: frontmatter wins, settings fallback
const agentAuth = fm.agentAuth || settings.agentAuth || {}
const strategy = agentAuth.strategy || 'tsh-okta-bedrock'

const tDir = taskDir(taskId)
const pidFile = path.join(tDir, 'running.pid')

// ─── PID overlap detection ────────────────────────────────────────────────────
if (fs.existsSync(pidFile)) {
  const existing = fs.readFileSync(pidFile, 'utf8').trim()
  if (existing) {
    try {
      process.kill(parseInt(existing), 0)
      console.error(`[${now()}] Skipping: task already running (PID ${existing})`)
      process.exit(0)
    } catch { /* process gone */ }
  }
  fs.rmSync(pidFile, { force: true })
}
fs.mkdirSync(tDir, { recursive: true })
fs.writeFileSync(pidFile, String(process.pid))

let exitCode = 1

// Cleanup on exit
process.on('exit', () => {
  try { fs.rmSync(pidFile, { force: true }) } catch { /* ok */ }
})
process.on('SIGTERM', () => process.exit(1))
process.on('SIGINT', () => process.exit(1))

// ─── Jitter ───────────────────────────────────────────────────────────────────
if (jitterSeconds > 0 && process.env.TIDE_NO_JITTER !== '1') {
  console.error(`[${now()}] jitter: sleeping ${jitterSeconds}s...`)
  await sleep(jitterSeconds * 1000)
  console.error(`[${now()}] jitter: done`)
}

// ─── Initialize run ───────────────────────────────────────────────────────────
const runId = crypto.randomBytes(4).toString('hex')
const startedAt = now()
const runDir = path.join(tDir, 'runs', runId)
fs.mkdirSync(runDir, { recursive: true })
const runFile = path.join(runDir, 'run.json')
const outputLog = path.join(runDir, 'output.log')
const stderrLog = path.join(runDir, 'stderr.log')

const runRecord = { runId, taskId, taskName, startedAt, argument }
if (parentRunId) runRecord.parentRunId = parentRunId
fs.writeFileSync(runFile, JSON.stringify(runRecord, null, 2))

console.error(`[${now()}] [${taskName}] [${runId}] starting`)

// ─── Resolve auth strategy ────────────────────────────────────────────────────
const strategyFn = AUTH_STRATEGIES[strategy]
if (!strategyFn) {
  const err = `agent-runner: unknown auth strategy: ${strategy}. Known: ${Object.keys(AUTH_STRATEGIES).join(', ')}`
  fs.appendFileSync(stderrLog, err + '\n')
  console.error(err)
  process.exit(1)
}

let sdkOptions
try {
  sdkOptions = await strategyFn(agentAuth, process.env)
} catch (e) {
  const err = `agent-runner: auth strategy failed: ${e.message}`
  fs.appendFileSync(stderrLog, err + '\n')
  console.error(err)
  process.exit(1)
}

// Detect claude binary — use CLAUDE_BIN env if set, else find it
const claudeBin = process.env.CLAUDE_BIN ||
  (fs.existsSync('/opt/homebrew/bin/claude') ? '/opt/homebrew/bin/claude' : 'claude')

// ─── SDK call with optional retries ───────────────────────────────────────────
const outputStream = fs.createWriteStream(outputLog, { flags: 'a' })

let attempt = 0
while (attempt <= maxRetries) {
  if (attempt > 0) {
    const backoff = attempt * 30000
    console.error(`[${now()}] [${taskName}] [${runId}] retry ${attempt}/${maxRetries} after ${attempt * 30}s...`)
    await sleep(backoff)
  }

  try {
    for await (const msg of query({
      prompt: argument,
      options: {
        pathToClaudeCodeExecutable: claudeBin,
        cwd: workingDirectory,
        permissionMode: 'bypassPermissions',
        allowDangerouslySkipPermissions: true,
        env: { ...process.env },
        persistSession: false,
        includePartialMessages: true,
        stderr: (data) => fs.appendFileSync(stderrLog, data),
        ...sdkOptions,
      }
    })) {
      if (msg.type === 'stream_event') {
        // Real-time token streaming — only source of text output
        const ev = msg.event
        if (ev?.type === 'content_block_delta' && ev.delta?.type === 'text_delta') {
          outputStream.write(ev.delta.text)
        }
      } else if (msg.type === 'result') {
        exitCode = msg.subtype === 'success' ? 0 : 1
        if (msg.subtype !== 'success') {
          const errMsg = `\n[agent-runner] run failed: ${msg.subtype}${msg.errors ? ' — ' + msg.errors.join('; ') : ''}\n`
          outputStream.write(errMsg)
        }
      }
    }
    if (exitCode === 0) break
  } catch (e) {
    const errMsg = `[agent-runner] SDK error: ${e.message}\n`
    fs.appendFileSync(stderrLog, errMsg)
    console.error(errMsg.trim())
    exitCode = 1
  }

  attempt++
}

outputStream.end()
await new Promise(resolve => outputStream.once('finish', resolve))

const completedAt = now()
console.error(`[${now()}] [${taskName}] [${runId}] finished: exit=${exitCode} attempts=${attempt}`)

// ─── Complete run.json ────────────────────────────────────────────────────────
const completedRecord = { runId, taskId, taskName, startedAt, completedAt, exitCode, attempts: attempt, argument }
if (parentRunId) completedRecord.parentRunId = parentRunId
fs.writeFileSync(runFile, JSON.stringify(completedRecord, null, 2))

// ─── Notification spool ───────────────────────────────────────────────────────
let outputSummary = ''
try {
  const buf = fs.readFileSync(outputLog, 'utf8')
  outputSummary = buf.slice(-300)
} catch { /* ok */ }

const notifDir = path.join(TIDE_DIR, 'notifications')
fs.mkdirSync(notifDir, { recursive: true })
const notifFile = path.join(notifDir, `${runId}.json`)
const tmp = notifFile + '.tmp'
fs.writeFileSync(tmp, JSON.stringify({
  taskId, taskName, runId, completedAt, exitCode,
  resultFile: runFile,
  summary: outputSummary.slice(0, 300),
  read: false,
}, null, 2))
fs.renameSync(tmp, notifFile)

// ─── Log rotation + run retention ────────────────────────────────────────────
rotateLog(outputLog)
rotateLog(stderrLog)
pruneOldRuns(taskId, resultRetentionDays)

// ─── macOS notification ───────────────────────────────────────────────────────
const notifTitle = exitCode === 0 ? `Tide: ${taskName} ✓` : `Tide: ${taskName} ✗`
const notifMsg = exitCode === 0 ? 'Task completed successfully.' : `Task failed (exit ${exitCode}).`
sendNotification(notifTitle, notifMsg, settings.terminalBundleId)

process.exit(exitCode)
