# What is Tide?

Tide is a macOS scheduler for AI agents — run Claude Code, GitHub Copilot, and Gemini tasks on a recurring interval via [launchd](https://developer.apple.com/library/archive/documentation/MacOSX/Conceptual/BPSystemStartup/Chapters/CreatingLaunchdJobs.html), with a terminal UI to manage runs, logs, and notifications.

## Why this exists

AI coding assistants don't have a persistent scheduler — any built-in scheduling only fires while the app is open. The moment you close it, all scheduled tasks stop.

Tide solves this by delegating execution to **macOS launchd** (`~/Library/LaunchAgents`). Jobs fire on schedule regardless of whether any app is open.

## Use cases

- Daily standup summaries (git log, open PRs, ticket status)
- Recurring code generation or analysis tasks
- Automated health checks that report back to you
- Any "run a prompt on a schedule" scenario where you need it to keep running unattended

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
2. **tide.sh** is a thin shim. It reads the `profile` from the task's `.md` file and hands off to `agent-runner.js`. For `claude-code` profiles with `tsh` auth, it wraps execution in `tsh aws` to inject AWS credentials.
3. **agent-runner.js** owns the full run lifecycle: PID overlap detection, jitter, calling the agent plugin, streaming tokens to `output.log` in real time, writing `run.json`, sending notifications, rotating logs, and pruning old runs.
4. **The TUI** polls `~/.tide/` on an interval and calls `launchctl print` per task to get live status. It only writes to launchd when you create, enable, disable, or delete a task.

## Limitations

### macOS only

Tide uses launchd and macOS-specific APIs (`launchctl`, `osascript` for notifications). It will not run on Linux or Windows.

### Interval-only scheduling

Tide only supports interval-based schedules (every N minutes, hours, etc.). Calendar-based scheduling ("run at 9am daily") is not supported — see [ADR-0001](/adr/0001-interval-only-scheduling) for why.

### Sleep and wake behaviour

launchd catches up missed `StartInterval` jobs on wake — if the interval elapsed while your Mac was asleep, the task fires once immediately on wake. This means tasks can fire at unpredictable clock times after a long sleep. A per-task jitter (0–min(interval/4, 300) seconds, assigned at creation) spreads tasks out so they don't all pile up on the same wake.
