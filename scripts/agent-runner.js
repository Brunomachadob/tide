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

// log() writes to stdout (captured by launchd) and, once the run dir is known,
// also appends to output.log so runner lifecycle lines appear in the Output tab.
// stderr.log is reserved for errors: SDK internal stderr + explicit logError() calls.
let _outputLog = null
let _stderrLog = null
let _logPrefix = ''
function log(msg) {
  const line = `[${now()}]${_logPrefix} ${msg}`
  process.stdout.write(line + '\n')
  if (_outputLog) try { fs.appendFileSync(_outputLog, line + '\n') } catch { /* ok */ }
}
function logError(msg) {
  const line = `[${now()}]${_logPrefix} ${msg}`
  process.stdout.write(line + '\n')
  if (_stderrLog) try { fs.appendFileSync(_stderrLog, line + '\n') } catch { /* ok */ }
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
  process.stdout.write('Usage: agent-runner.js <taskId>\n')
  process.exit(1)
}

const taskFile = process.env.TIDE_TASK_FILE
if (!taskFile || !fs.existsSync(taskFile)) {
  process.stdout.write(`agent-runner: TIDE_TASK_FILE not set or not found: ${taskFile}\n`)
  process.exit(1)
}

const raw = fs.readFileSync(taskFile, 'utf8')
const { data: fm, content: body } = matter(raw)
const settings = readSettings()

const taskName = fm.name || path.basename(taskFile, '.md')
const argument = process.env.TIDE_OVERRIDE_ARGUMENT ?? body.trim()
const workingDirectory = fm.workingDirectory
  ? fm.workingDirectory.replace(/^~/, os.homedir())
  : os.homedir()
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
// Set up prefix for pre-run log lines (no runId yet)
_logPrefix = ` [${taskName}]`
if (fs.existsSync(pidFile)) {
  const existing = fs.readFileSync(pidFile, 'utf8').trim()
  if (existing) {
    try {
      process.kill(parseInt(existing), 0)
      log(`skipping: task already running (PID ${existing})`)
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
  log(`jitter: sleeping ${jitterSeconds}s...`)
  await sleep(jitterSeconds * 1000)
  log('jitter: done, proceeding')
}

// ─── Initialize run ───────────────────────────────────────────────────────────
const runId = crypto.randomBytes(4).toString('hex')
const startedAt = now()
const runDir = path.join(tDir, 'runs', runId)
fs.mkdirSync(runDir, { recursive: true })
const runFile = path.join(runDir, 'run.json')
const outputLog = path.join(runDir, 'output.log')
const stderrLog = path.join(runDir, 'stderr.log')

// Wire log() → output.log, logError() → stderr.log from here on
_outputLog = outputLog
_stderrLog = stderrLog
_logPrefix = ` [${taskName}] [${runId}]`

const runRecord = { runId, taskId, taskName, startedAt, argument }
if (parentRunId) runRecord.parentRunId = parentRunId
fs.writeFileSync(runFile, JSON.stringify(runRecord, null, 2))

log('starting')

// ─── Resolve auth strategy ────────────────────────────────────────────────────
log(`auth: strategy=${strategy}`)
const strategyFn = AUTH_STRATEGIES[strategy]
if (!strategyFn) {
  logError(`error: unknown auth strategy "${strategy}". Known: ${Object.keys(AUTH_STRATEGIES).join(', ')}`)
  process.exit(1)
}

let sdkOptions
try {
  sdkOptions = await strategyFn(agentAuth, process.env)
  log(`auth: ok`)
} catch (e) {
  logError(`auth failed: ${e.message}`)
  process.exit(1)
}

// Detect claude binary — use CLAUDE_BIN env if set, else find it
const claudeBin = process.env.CLAUDE_BIN ||
  (fs.existsSync('/opt/homebrew/bin/claude') ? '/opt/homebrew/bin/claude' : 'claude')
log(`claude binary: ${claudeBin}`)
log(`working directory: ${workingDirectory}`)

// ─── SDK call with optional retries ───────────────────────────────────────────
const outputStream = fs.createWriteStream(outputLog, { flags: 'a' })

let attempt = 0
while (attempt <= maxRetries) {
  if (attempt > 0) {
    const backoff = attempt * 30
    log(`retry ${attempt}/${maxRetries} after ${backoff}s...`)
    await sleep(backoff * 1000)
  }

  log(`command starting (attempt ${attempt + 1}${maxRetries > 0 ? `/${maxRetries + 1}` : ''})`)

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
          logError(`run failed: ${msg.subtype}${msg.errors ? ' — ' + msg.errors.join('; ') : ''}`)
        }
      }
    }
    log(`command finished: exit=${exitCode}`)
    if (exitCode === 0) break
  } catch (e) {
    logError(`SDK error: ${e.message}`)
    exitCode = 1
  }

  attempt++
}

outputStream.end()
await new Promise(resolve => outputStream.once('finish', resolve))

const completedAt = now()
log(`finished: exit=${exitCode} attempts=${attempt}`)

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
