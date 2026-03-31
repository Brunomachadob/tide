# ADR-0004: Claude stream-json for real-time log output
Date: 2026-03-31
Status: Accepted

## Context

When `task-runner.sh` runs a command, stdout is redirected to `output.log` via `>>`. Programs that detect a non-TTY stdout switch to fully-buffered mode — nothing is written to the file until the process exits or fills its internal buffer. This means the TUI's log viewer shows no output while the task is running, only after it completes.

This is particularly visible with Claude CLI (`claude --print`), which is the primary command Tide is designed around. A Claude task that runs for several minutes produces no log output until the very end, making the follow/auto-refresh feature useless during execution.

Several approaches were investigated:

- **`stdbuf -oL`** — injects into libc's `setvbuf` via `DYLD_INSERT_LIBRARIES`. Does not work on Node.js programs (including Claude CLI) because Node manages its own stdout buffering outside of libc.
- **PTY wrapping via `script`** — allocates a pseudo-terminal so the program thinks it is writing to a terminal. Forces line-buffering but merges stdout and stderr, introduces CRLF line endings and control-character artifacts (`^D\b\b`) in the log file, and requires non-trivial output sanitisation. Also untested under launchd's sessionless environment.
- **`--output-format=stream-json`** — Claude CLI's native streaming mode. Emits one NDJSON line per event as it arrives, flushing immediately regardless of TTY state. Produces clean, parseable output with no PTY artifacts.

## Decision

Introduce an opt-in task field `claudeStreamJson` (boolean, default `false`). When enabled:

1. `task-runner.sh` pipes the command's stdout through `scripts/claude-stream-extract.js` instead of redirecting it directly to `output.log`.
2. `claude-stream-extract.js` reads the NDJSON stream line-by-line, extracts text tokens from `stream_event` / `content_block_delta` events, and writes plain text to stdout — which is then appended to `output.log`.

This is deliberately named `claudeStreamJson` rather than a generic "stream output" option because the extractor is coupled to Claude CLI's specific NDJSON schema (`{"type":"stream_event","event":{"type":"content_block_delta","delta":{"type":"text_delta","text":"..."}}}`). It is not a general-purpose streaming mechanism.

The command must include `--output-format=stream-json --include-partial-messages --verbose` for this to work. These flags are the user's responsibility — Tide does not modify the command string.

## Consequences

- Real-time log following works for Claude tasks that opt in and configure the command correctly.
- Non-Claude commands, or Claude commands without the required flags, are unaffected — they continue to use direct redirection.
- If Claude CLI changes its stream-json schema, `claude-stream-extract.js` will need to be updated.
- The exit code of the command is preserved via zsh's `$pipestatus[1]`, so retry logic and result recording are unaffected.
- stderr is still redirected separately to `stderr.log`; the stream-json pipe only applies to stdout.
