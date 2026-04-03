# ADR-0009: Agent SDK Runner
Date: 2026-04-03
Status: Accepted

## Context

Running the `claude26` CLI from launchd was fragile. The execution chain spanned multiple processes: launchd → `tide.sh` (zsh) → `task-setup.js` (eval) → `tsh aws --exec` → bash → claude binary → `claude-stream-extract.js` → `task-postprocess.js`. Each hop was a failure point in launchd's restricted environment, where PATH, auth tokens, and shell behaviour differ from an interactive terminal.

The main pain points were:
- The `tsh aws --exec bash -- -lc "$REMOTE_CMD"` pattern was difficult to get right under launchd
- Output streaming relied on parsing NDJSON from the claude CLI's `--output-format=stream-json` mode
- Error handling across the shell/Node boundary was brittle

## Decision

Introduce `scripts/agent-runner.js`, a self-contained Node.js script that uses `@anthropic-ai/claude-agent-sdk` to run Claude tasks. It replaces `task-setup.js` + the CLI invocation + `task-postprocess.js` for tasks that opt in via `agentRunner: true` in their frontmatter.

**Execution model**: `tide.sh` remains the launchd entry point. After reading config, if `AGENT_RUNNER=1` it does:

```bash
exec tsh aws --proxy $PROXY --auth okta --app $APP --aws-role $ROLE \
  --exec node -- scripts/agent-runner.js $TASK_ID
```

`exec` hands off the process entirely — `tide.sh`'s EXIT trap does not fire. `agent-runner.js` owns the full run lifecycle (PID check, jitter, SDK call, `run.json`, notifications, log rotation, run retention).

**Auth strategies**: a pluggable registry maps strategy names to functions that validate the environment and return SDK options. The only built-in strategy is `tsh-okta-bedrock`, which relies on environment variables injected by tsh (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `HTTPS_PROXY`). Future strategies (plain API key, other Bedrock configs) can be added without changing the runner.

**Streaming**: the SDK's async generator yields `stream_event` messages with `content_block_delta` events. Text deltas are written to `output.log` in real time — no separate NDJSON parsing script needed.

**No plist changes**: `agentRunner` is evaluated at runtime inside `tide.sh`. The plist `ProgramArguments` still points to `tide.sh`, so no changes to `create.js`, `taskfile.js`, or `launchd.js` are required.

## Consequences

- Tasks with `agentRunner: true` get a cleaner, more reliable execution path with structured error handling.
- Existing tasks (`agentRunner: false` or absent) are completely unaffected.
- `@anthropic-ai/claude-agent-sdk` becomes a runtime dependency.
- The `agentRunner` flag is not a plist-diffable field, so the TUI does not prompt to sync when it changes — acceptable for an execution-strategy flag.
- The SDK spawns the claude binary internally; `pathToClaudeCodeExecutable` must point to a valid binary in the execution environment.
