#!/usr/bin/env node
// stream-extract.js — reads claude --output-format=stream-json NDJSON from stdin,
// writes plain text tokens to stdout as they arrive.
// Used by tide.sh when claudeStreamJson=true on a task.
import readline from 'readline'

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity })

// Track in-progress tool_use blocks by index so we can print their name when input arrives
const toolUseBlocks = {} // index -> { name, inputBuf }
let wroteTextThisTurn = false

rl.on('line', line => {
  if (!line.trim()) return
  let event
  try { event = JSON.parse(line) } catch { return }

  // claude CLI wraps stream events: {"type":"stream_event","event":{...}}
  const inner = event.type === 'stream_event' ? event.event : null

  if (inner) {
    if (inner.type === 'message_start') {
      wroteTextThisTurn = false
    } else if (inner.type === 'content_block_start') {
      const cb = inner.content_block ?? {}
      if (cb.type === 'tool_use') {
        toolUseBlocks[inner.index] = { name: cb.name, inputBuf: '' }
        process.stdout.write(`\n[tool: ${cb.name}] `)
        wroteTextThisTurn = true
      }
    } else if (inner.type === 'content_block_delta') {
      const delta = inner.delta ?? {}
      if (delta.type === 'text_delta') {
        process.stdout.write(delta.text)
        wroteTextThisTurn = true
      } else if (delta.type === 'input_json_delta') {
        const block = toolUseBlocks[inner.index]
        if (block) block.inputBuf += delta.partial_json ?? ''
      }
    } else if (inner.type === 'content_block_stop') {
      const block = toolUseBlocks[inner.index]
      if (block) {
        // Print the accumulated tool input on one line
        let inputStr = block.inputBuf.trim()
        if (inputStr) {
          try {
            const parsed = JSON.parse(inputStr)
            // For readability: prefer 'command', 'prompt', 'description', or first string value
            const summary = parsed.command ?? parsed.prompt ?? parsed.description ?? parsed.query
              ?? Object.values(parsed).find(v => typeof v === 'string')
              ?? inputStr
            process.stdout.write(`${String(summary).slice(0, 200)}\n`)
          } catch {
            process.stdout.write(`${inputStr.slice(0, 200)}\n`)
          }
        } else {
          process.stdout.write('\n')
        }
        delete toolUseBlocks[inner.index]
      }
    } else if (inner.type === 'message_stop') {
      if (wroteTextThisTurn) process.stdout.write('\n')
    }
    return
  }

  // Top-level event types
  if (event.type === 'user') {
    // Tool results — both regular tools and sub-agents
    const content = event.message?.content ?? []
    for (const block of content) {
      if (block.type !== 'tool_result') continue

      const toolResult = event.tool_use_result

      if (toolResult?.status !== undefined) {
        // Sub-agent result
        const agentType = toolResult.agentType ?? 'agent'
        const ms = toolResult.totalDurationMs ?? toolResult.durationMs ?? ''
        const durationStr = ms ? ` (${(ms / 1000).toFixed(1)}s)` : ''
        process.stdout.write(`[${agentType} result${durationStr}]\n`)
        const resultContent = toolResult.content ?? block.content ?? []
        const texts = Array.isArray(resultContent)
          ? resultContent.filter(c => c.type === 'text').map(c => c.text)
          : typeof resultContent === 'string' ? [resultContent] : []
        for (const text of texts) {
          // Skip the agentId metadata line
          if (text.startsWith('agentId:')) continue
          process.stdout.write(text.trimEnd() + '\n')
        }
      } else {
        // Regular tool result — stdout/stderr from tool_use_result, or content string
        const stdout = toolResult?.stdout ?? (typeof block.content === 'string' ? block.content : null)
        const stderr = toolResult?.stderr
        const isError = block.is_error || toolResult?.isError
        if (stdout && stdout.trim()) {
          process.stdout.write((isError ? '[error] ' : '') + stdout.trimEnd() + '\n')
        }
        if (stderr && stderr.trim()) {
          process.stdout.write(`[stderr] ${stderr.trimEnd()}\n`)
        }
      }
      wroteTextThisTurn = true
    }
    return
  }

  if (event.type === 'result') {
    // Final result line — ensure output ends with a newline
    if (typeof event.result === 'string' && event.result.trim() && !event.result.endsWith('\n')) {
      process.stdout.write('\n')
    }
    // Exit non-zero if Claude reported a failure or error
    if (event.is_error || event.subtype === 'failure') process.exit(1)
  }
})
