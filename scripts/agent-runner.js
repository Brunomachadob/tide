#!/usr/bin/env node
// agent-runner.js — SDK-based task runner.
// Invoked by tide.sh via: node -- agent-runner.js <taskId>
// For claude-code agent, tsh aws credentials are already in process.env.
// Owns the full run lifecycle: init → SDK query → postprocess.
import crypto from 'crypto'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { spawnSync } from 'child_process'
import matter from 'gray-matter'
import { AUTH_HANDLERS } from './lib/agent-auth.js'
import { runOnce as runClaudeAgent } from './lib/plugins/claude-agent.js'
import { runOnce as runCopilotAgent } from './lib/plugins/copilot-agent.js'
import { runOnce as runGeminiAgent } from './lib/plugins/gemini-agent.js'
import { configureLogger, log, logError, rotateLog, sleep, now } from './lib/agent-logger.js'
import { initRun, completeRun, spoolNotification, pruneOldRuns } from './lib/agent-runs.js'
import { readSettings } from '../src/lib/settings.js'

const AGENT_PLUGINS = {
  'claude-code': runClaudeAgent,
  'copilot': runCopilotAgent,
  'gemini': runGeminiAgent,
}

/**
 * Run a plugin function with retry logic.
 * Calls runOnce(opts) up to (1 + maxRetries) times with exponential backoff.
 * Returns { exitCode, attempts }.
 */
async function withRetries(runOnce, opts) {
  const { maxRetries = 0, timeoutSeconds = null, log, logError, sleep, ...pluginOpts } = opts
  let exitCode = 1
  let attempt = 0

  while (attempt <= maxRetries) {
    if (attempt > 0) {
      const backoff = attempt * 30
      log(`retry ${attempt}/${maxRetries} after ${backoff}s...`)
      await sleep(backoff * 1000)
    }

    log(`command starting (attempt ${attempt + 1}${maxRetries > 0 ? `/${maxRetries + 1}` : ''})`)

    let timeoutHandle = null
    try {
      if (timeoutSeconds) {
        log(`timeout: will kill after ${timeoutSeconds}s`)
        timeoutHandle = setTimeout(() => {
          logError(`timeout: ${timeoutSeconds}s elapsed — killing process group`)
          try { process.kill(-process.pid, 'SIGTERM') } catch { /* already gone */ }
          process.exit(124)
        }, timeoutSeconds * 1000)
        timeoutHandle.unref()
      }

      ;({ exitCode } = await runOnce({ ...pluginOpts, log, logError }))
      log(`command finished: exit=${exitCode}`)
      if (exitCode === 0) return { exitCode, attempts: attempt + 1 }
    } catch (e) {
      logError(`agent error: ${e.message}`)
      exitCode = 1
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle)
    }

    attempt++
  }

  return { exitCode, attempts: attempt }
}

const TIDE_DIR = path.join(os.homedir(), '.tide')

// ─── CLI validation ───────────────────────────────────────────────────────────

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

// ─── Parse task file ──────────────────────────────────────────────────────────

const raw = fs.readFileSync(taskFile, 'utf8')
const { data: fm, content: body } = matter(raw)
const settings = readSettings()

const taskName = fm.name || path.basename(taskFile, '.md')
const argument = process.env.TIDE_OVERRIDE_ARGUMENT ?? body.trim()
const workingDirectory = fm.workingDirectory
  ? fm.workingDirectory.replace(/^~/, os.homedir())
  : os.homedir()
const jitterSeconds = parseInt(process.env.TIDE_JITTER ?? '0') || 0
const maxRetries = fm.maxRetries ?? 0
const timeoutSeconds = fm.timeoutSeconds ?? null
const resultRetentionDays = fm.resultRetentionDays ?? 30
const parentRunId = process.env.TIDE_PARENT_RUN_ID || fm.parentRunId || undefined

// Resolve profile: frontmatter `profile` key → settings.profiles[key]
const profileKey = typeof fm.profile === 'string' ? fm.profile : null
const profile = (profileKey && settings.profiles?.[profileKey]) || {}
const agent = process.env.TIDE_AGENT || profile.agent || 'claude-code'
const model = profile.model || null
const auth = profile.auth || {}
const authType = auth.type

// Apply profile env vars — task-level env (already in process.env via plist) takes precedence
if (profile.env) {
  for (const [k, v] of Object.entries(profile.env)) {
    if (!(k in process.env)) process.env[k] = v
  }
}

// ─── PID overlap detection ────────────────────────────────────────────────────

const tDir = path.join(TIDE_DIR, 'tasks', taskId)
const pidFile = path.join(tDir, 'running.pid')

configureLogger({ prefix: ` [${taskName}]` })

const runId = crypto.randomBytes(4).toString('hex')

if (fs.existsSync(pidFile)) {
  const [, existingPid] = fs.readFileSync(pidFile, 'utf8').trim().split(':')
  if (existingPid) {
    try {
      process.kill(parseInt(existingPid), 0)
      log(`skipping: task already running (PID ${existingPid})`)
      process.exit(0)
    } catch { /* process gone */ }
  }
  fs.rmSync(pidFile, { force: true })
}
fs.mkdirSync(tDir, { recursive: true })
fs.writeFileSync(pidFile, `${runId}:${process.pid}`)

let exitCode = 1

process.on('exit', () => {
  try { fs.rmSync(pidFile, { force: true }) } catch { /* ok */ }
})
process.on('SIGINT', () => process.exit(1))

// Will be replaced with a proper handler after initRun() when runFile is available.
// This early handler covers the window between pid file write and initRun.
let sigTermHandler = () => {
  logError('terminated: killed before run initialized')
  process.exit(1)
}
process.on('SIGTERM', () => sigTermHandler())

// ─── Jitter ───────────────────────────────────────────────────────────────────

if (jitterSeconds > 0 && process.env.TIDE_NO_JITTER !== '1') {
  log(`jitter: sleeping ${jitterSeconds}s...`)
  await sleep(jitterSeconds * 1000)
  log('jitter: done, proceeding')
}

// ─── Initialize run ───────────────────────────────────────────────────────────

const startedAt = now()
const { runDir, runFile, outputLog, stderrLog } =
  initRun(TIDE_DIR, taskId, taskName, runId, startedAt, argument, parentRunId)

configureLogger({ outputLog, stderrLog, prefix: ` [${taskName}] [${runId}]` })
log('starting')
log(`agent: ${agent}${model ? `  model: ${model}` : ''}${authType ? `  auth: ${authType}` : ''}`)

// Upgrade SIGTERM handler now that runFile is available — write a proper completion record.
sigTermHandler = () => {
  logError('terminated: killed by external signal')
  completeRun(runFile, { runId, taskId, taskName, startedAt, completedAt: now(), exitCode: 1, attempts: 1, argument, parentRunId })
  process.exit(1)
}

// ─── Unhandled rejection safety net ──────────────────────────────────────────
// Catches errors that escape plugin try/catch (e.g. SDK internal async throws).
// Ensures run.json is always written and the process exits cleanly.
process.on('unhandledRejection', (reason) => {
  logError(`unhandled rejection: ${reason instanceof Error ? reason.message : String(reason)}`)
  completeRun(runFile, { runId, taskId, taskName, startedAt, completedAt: now(), exitCode: 1, attempts: 1, argument, parentRunId })
  process.exit(1)
})

// ─── Resolve auth ─────────────────────────────────────────────────────────────

let sdkOptions = {}
if (authType) {
  const authHandler = AUTH_HANDLERS[authType]
  if (!authHandler) {
    logError(`error: unknown auth type "${authType}". Known: ${Object.keys(AUTH_HANDLERS).join(', ')}`)
    process.exit(1)
  }
  try {
    sdkOptions = await authHandler(auth, process.env, model)
    log('auth: ok')
  } catch (e) {
    logError(`auth failed: ${e.message}`)
    process.exit(1)
  }
}

if (model) sdkOptions = { ...sdkOptions, model }

// ─── Run agent plugin ─────────────────────────────────────────────────────────

const runAgent = AGENT_PLUGINS[agent]
if (!runAgent) {
  logError(`error: unknown agent "${agent}". Known: ${Object.keys(AGENT_PLUGINS).join(', ')}`)
  process.exit(1)
}

const outputStream = fs.createWriteStream(outputLog, { flags: 'a' })

const result = await withRetries(runAgent, {
  argument, workingDirectory, outputStream, stderrLog, sdkOptions,
  maxRetries, timeoutSeconds, log, logError, sleep,
})
exitCode = result.exitCode
const attempt = result.attempts

outputStream.end()
await new Promise(resolve => outputStream.once('finish', resolve))

const completedAt = now()
log(`finished: exit=${exitCode} attempts=${attempt}`)

// ─── Postprocess ──────────────────────────────────────────────────────────────

completeRun(runFile, { runId, taskId, taskName, startedAt, completedAt, exitCode, attempts: attempt, argument, parentRunId })

spoolNotification(TIDE_DIR, { taskId, taskName, runId, completedAt, exitCode, runFile, outputLog })

rotateLog(outputLog)
rotateLog(stderrLog)
pruneOldRuns(TIDE_DIR, taskId, resultRetentionDays)

// ─── macOS notification ───────────────────────────────────────────────────────

if (process.env.TIDE_NO_NOTIFY !== '1') {
  const title = exitCode === 0 ? `Tide: ${taskName} ✓` : `Tide: ${taskName} ✗`
  const message = exitCode === 0 ? 'Task completed successfully.' : `Task failed (exit ${exitCode}).`
  if (spawnSync('which', ['terminal-notifier'], { encoding: 'utf8' }).status === 0) {
    spawnSync('terminal-notifier', ['-title', title, '-message', message])
  } else {
    spawnSync('osascript', ['-e', `display notification "${message}" with title "${title}"`])
  }
}

process.exit(exitCode)
