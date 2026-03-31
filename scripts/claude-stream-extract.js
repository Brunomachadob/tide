#!/usr/bin/env node
// stream-extract.js — reads claude --output-format=stream-json NDJSON from stdin,
// writes plain text tokens to stdout as they arrive.
// Used by tide.sh when claudeStreamJson=true on a task.
import readline from 'readline'

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity })

let wroteTextThisTurn = false

rl.on('line', line => {
  if (!line.trim()) return
  let event
  try { event = JSON.parse(line) } catch { return }

  // claude CLI wraps stream events: {"type":"stream_event","event":{...}}
  const inner = event.type === 'stream_event' ? event.event : event

  if (inner.type === 'message_start') {
    wroteTextThisTurn = false
  } else if (inner.type === 'content_block_delta' && inner.delta?.type === 'text_delta') {
    process.stdout.write(inner.delta.text)
    wroteTextThisTurn = true
  } else if (inner.type === 'message_stop') {
    // Separate assistant turns with a newline, but only if this turn produced text
    if (wroteTextThisTurn) process.stdout.write('\n')
  } else if (event.type === 'result') {
    // Final result line — ensure output ends with a newline
    if (typeof event.result === 'string' && !event.result.endsWith('\n')) process.stdout.write('\n')
    // Exit non-zero if Claude reported a failure or error
    if (event.is_error || event.subtype === 'failure') process.exit(1)
  }
})
