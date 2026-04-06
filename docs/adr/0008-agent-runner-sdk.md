# ADR-0008: Agent SDK Runner
Date: 2026-04-03
Status: Accepted

## Context

Running the `claude` CLI from launchd was fragile. The execution chain spanned multiple processes: launchd → `tide.sh` (zsh) → `task-setup.js` (eval) → `tsh aws --exec` → bash → claude binary → `claude-stream-extract.js` → `task-postprocess.js`. Each hop was a failure point in launchd's restricted environment, where PATH, auth tokens, and shell behaviour differ from an interactive terminal.

The main pain points were:
- The `tsh aws --exec bash -- -lc "$REMOTE_CMD"` pattern was difficult to get right under launchd
- Output streaming relied on parsing NDJSON from the claude CLI's `--output-format=stream-json` mode
- Error handling across the shell/Node boundary was brittle

## Decision

Introduce `scripts/agent-runner.js`, a self-contained Node.js script that owns the full run lifecycle. It replaces `task-setup.js` + the CLI invocation + `task-postprocess.js`.

**Execution model**: `tide.sh` remains the launchd entry point. It reads the `profile` from the task's `.md` file and hands off to `agent-runner.js`. For `claude-code` profiles with `tsh-okta-bedrock` auth, it wraps in `tsh aws`:

```bash
exec tsh aws --proxy $PROXY --auth okta --app $APP --aws-role $ROLE \
  --exec node -- scripts/agent-runner.js $TASK_ID
```

For other agents (Copilot, Gemini), `tide.sh` calls `node` directly. `exec` hands off the process entirely. `agent-runner.js` owns the full run lifecycle (PID check, jitter, agent plugin call, `run.json`, notifications, log rotation, run retention).

**Agent plugins**: a pluggable registry (`AGENT_PLUGINS`) maps agent names to runner functions. Built-in agents: `claude-code` (via `@anthropic-ai/claude-agent-sdk`), `copilot` (via `@github/copilot-sdk`), `gemini` (via `ai-sdk-provider-gemini-cli` + Vercel AI SDK).

**Auth handlers**: a separate pluggable registry (`AUTH_HANDLERS`) maps auth type names to functions that return SDK options. Built-in types: `tsh-okta-bedrock` (injects Bedrock credentials via tsh), `copilot`, `gemini`.

**Profiles**: configuration is stored in `~/.tide/settings.json` under `profiles` as a named map. Each profile declares `agent`, optional `model`, and optional `auth`. Task frontmatter references a profile by key (`profile: my-claude`). `agent-runner.js` resolves the key at runtime — credentials stay out of task files and multiple profiles coexist.

**Streaming**: each agent plugin writes output tokens to `output.log` in real time as they arrive.

**TIDE_AGENT in plist**: `create.js` encodes the profile's `agent` value as a `TIDE_AGENT` environment variable in the plist. `tide.sh` reads this to decide whether to wrap in `tsh aws` — no `.md` parsing needed in the shell script.

## Consequences

- All tasks use the agent-runner path — no opt-in flag needed.
- Multiple agent backends (Claude Code, Copilot, Gemini) are supported via the plugin registry.
- `@anthropic-ai/claude-agent-sdk`, `@github/copilot-sdk`, and `ai-sdk-provider-gemini-cli` are runtime dependencies.
- The SDK spawns the claude binary internally; the binary must be present in the execution environment for `claude-code` profiles.
