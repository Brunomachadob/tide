# What is Tide?

Tide is a macOS task scheduler with a terminal UI. Define a command and a schedule, and Tide runs it in the background using [launchd](https://developer.apple.com/library/archive/documentation/MacOSX/Conceptual/BPSystemStartup/Chapters/CreatingLaunchdJobs.html). Think of it as a personal cron, but one you can actually manage without editing files.

## Why this exists

Claude Code has a built-in scheduler (`CronCreate`/`CronDelete`), but it only fires jobs during an **active Claude REPL session**. The moment you close Claude, all scheduled tasks stop.

Tide solves this by delegating execution to **macOS launchd** (`~/Library/LaunchAgents`). Jobs fire on schedule regardless of whether Claude — or any other app — is open.

## Use cases

- Daily standup summaries (git log, open PRs, ticket status)
- Recurring code generation or analysis tasks
- Automated health checks that report back to you
- Any "run a command on a schedule" scenario where you need it to keep running unattended

## How it works

Tide has two distinct layers:

```
launchd (scheduling)
  └─ tide.sh → agent-runner.js
                 ├─ claude-code: @anthropic-ai/claude-agent-sdk
                 ├─ copilot:     @github/copilot-sdk
                 ├─ gemini:      ai-sdk-provider-gemini-cli + Vercel AI SDK
                 ├─ streams output to ~/.tide/tasks/<id>/runs/<runId>/output.log
                 └─ writes run.json, notifications, rotates logs, prunes old runs

TUI (src/) — reads ~/.tide/, never writes to launchd except on create/enable/disable/delete
```

1. **launchd** owns the schedule. Each task is a plist in `~/Library/LaunchAgents/`. launchd fires `tide.sh <id>` on your configured interval.
2. **tide.sh** is a thin shim. It reads the `profile` from the task's `.md` file and hands off to `agent-runner.js`. For `claude-code` profiles with `tsh-okta-bedrock` auth, it wraps execution in `tsh aws` to inject AWS credentials.
3. **agent-runner.js** owns the full run lifecycle: PID overlap detection, jitter, calling the agent plugin, streaming tokens to `output.log` in real time, writing `run.json`, sending notifications, rotating logs, and pruning old runs.
4. **The TUI** polls `~/.tide/` on an interval and calls `launchctl print` per task to get live status. It only writes to launchd when you create, enable, disable, or delete a task.

## Limitations

**macOS sleep:** launchd catches up missed `StartInterval` jobs on wake — if the interval elapsed while your Mac was asleep, the task fires once immediately on wake. This is intentional and generally preferable to silently skipping the run, but it means tasks can fire at unpredictable clock times. A per-task jitter (0–min(interval/4, 300) seconds, assigned at creation) spreads tasks out so they don't all fire simultaneously after a long sleep.

**macOS only:** Tide uses launchd and macOS-specific APIs (`launchctl`, `osascript` for notifications). It will not run on Linux or Windows.

**Interval-only scheduling:** Tide only supports interval-based schedules (every N seconds). Calendar-based scheduling ("run at 9am daily") is not supported — see [ADR-0001](/adr/0001-interval-only-scheduling) for why.
