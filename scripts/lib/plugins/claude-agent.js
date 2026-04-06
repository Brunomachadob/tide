// Claude Code agent plugin for agent-runner.js.
// Plugin interface: runOnce(opts) → Promise<{ exitCode: number }>
import fs from 'fs'
import { query } from '@anthropic-ai/claude-agent-sdk'

/**
 * Detect the claude binary path.
 * Uses CLAUDE_BIN env if set, then checks the Homebrew path, falls back to PATH lookup.
 */
export function resolveClaudeBin(env = process.env) {
  return env.CLAUDE_BIN ||
    (fs.existsSync('/opt/homebrew/bin/claude') ? '/opt/homebrew/bin/claude' : 'claude')
}

/**
 * Run one Claude Code agent attempt.
 *
 * @param {object} opts
 * @param {string}         opts.argument         — the prompt to run
 * @param {string}         opts.workingDirectory  — cwd for the agent
 * @param {fs.WriteStream} opts.outputStream      — stream to write text output to
 * @param {string}         opts.stderrLog         — path to append SDK stderr to
 * @param {object}         opts.sdkOptions        — extra options merged into query()
 * @returns {Promise<{ exitCode: number }>}
 */
export async function runOnce({ argument, workingDirectory, outputStream, stderrLog, sdkOptions, log, logError }) {
  const claudeBin = resolveClaudeBin(process.env)
  log(`claude binary: ${claudeBin}`)
  log(`working directory: ${workingDirectory}`)

  let exitCode = 1
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
  outputStream.write('\n')
  return { exitCode }
}
