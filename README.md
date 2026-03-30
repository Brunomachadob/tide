# Tide

Tide is a macOS task scheduler with a terminal UI. Define a command and a schedule, and Tide runs it in the background — whether Claude is open or not, whether you're at your desk or not. Think of it as a personal cron, but one you can actually manage without editing files.

## Why This Exists

Claude Code has a built-in scheduler (`CronCreate`/`CronDelete`) but it only fires jobs during an **active Claude REPL session**. The moment you close Claude, all scheduled tasks stop.

Tide solves this by using **macOS launchd** (`~/Library/LaunchAgents`) as the execution engine. Jobs fire on schedule regardless of whether Claude is open, similar to how cron jobs work.

### Use Cases

- Daily summaries (git log, open PRs, ticket status)
- Recurring code generation or analysis tasks
- Automated health checks that report back to you
- Any "run Claude on a schedule" scenario

For implementation details, directory layout, and TUI development guide, see [CLAUDE.md](CLAUDE.md).

### Limitations

**macOS sleep affects calendar and interval tasks differently:**

- **Calendar tasks** (`StartCalendarInterval`): if your Mac is asleep at the scheduled time, that run is skipped entirely — no catch-up on wake. If you need a task to reliably run at a specific time, make sure your machine is awake (e.g. use a power schedule in System Settings → Battery → Schedule). Note: `cron` has the same limitation — this is a macOS constraint, not specific to Tide.
- **Interval tasks** (`StartInterval`): launchd catches up on wake — if the interval has elapsed while the machine was asleep, the task fires once immediately on wake.

### Permission Model

Scheduled tasks run headlessly with no TTY. Without explicit permission handling, a task that tries to use an unapproved tool will hang indefinitely until launchd kills it.

The default permission mode is `bypassPermissions` — all tools pre-approved, no prompts. This is the right default for scheduled tasks since you control the prompt. You can override per-task to `acceptEdits` (auto-approve file edits, block Bash) or `default` (not recommended for scheduled tasks).

### Notification Design

Completed tasks are never silently discarded. Each run appends an entry to `pending-notifications.json` and fires a native macOS notification. Open the TUI to review results and clear pending notifications.

## TUI

Launch with:

```sh
node tui/index.js
```

| Screen | What you can do |
|--------|----------------|
| Task list | View all tasks, their schedule, status, and last result |
| Task detail | See full config and live launchd status |
| Create task | Name, command, schedule, working directory |
| Logs | Tail stdout/stderr for any task |
| Results | Browse structured execution results |
| Notifications | Review and clear completed-run summaries |
| Settings | Claude command, working directory, date format, timezone |

## Task Data Model

```json
{
  "id": "3f640f65",
  "name": "Daily standup summary",
  "prompt": "Summarize git log from the last 24h in /path/to/repo and list any open PRs",
  "command": "/opt/homebrew/bin/claude26",
  "extraArgs": [],
  "schedule": {
    "type": "calendar",
    "hour": 9,
    "minute": 0
  },
  "createdAt": "2026-03-29T10:00:00Z",
  "enabled": true,
  "maxRetries": 0,
  "permissionMode": "bypassPermissions",
  "workingDirectory": "/Users/brunobrandao",
  "env": {}
}
```

Schedule types:
- `calendar` — `{ type, hour, minute, days? }` → fires at a specific time (optionally on specific weekdays)
- `interval` — `{ type, intervalSeconds }` → fires every N seconds

## Installation

The plugin is part of the [edge-tools](../../../) marketplace. It is installed automatically when you run `/plugin` in Claude Code with the `n26-edge-team` marketplace configured.

After changes to the plugin source, run `/plugin` then `/reload-plugins` to apply. See [CLAUDE.md](CLAUDE.md) for development setup.

---

## TODO / Future Improvements

### UX
- [ ] **Natural language schedule parsing** — accept "every weekday at 9am", "every Monday", "twice a day" instead of requiring structured input
- [ ] **Status dashboard** — show all tasks with next scheduled fire time and a sparkline of last 10 exit codes
- [ ] **Task templates** — predefined prompt templates for common use cases (daily git summary, PR review, ticket triage)
- [ ] **Pause task** — temporarily suspend a task for N hours/days without deleting it

### Reliability
- [x] **Max log size rotation** — cap `output.log` at e.g. 5MB with automatic rotation to prevent unbounded growth
- [x] **Result retention policy** — auto-prune result JSON files older than N days (configurable per task)
- [x] **Task timeout** — add a `timeoutSeconds` field and use launchd's `TimeOut` key to kill hung tasks
- [x] **Overlapping run detection** — PID file at `tasks/<id>/running.pid`; if the process is still alive the new invocation exits immediately

### Notifications
- [x] **macOS native notification** — fires a native macOS notification when a task completes

### Features
- [ ] **Output post-processing** — optional `outputFile` field to write Claude's response to a specific file (e.g. `~/Desktop/standup.md`)
- [ ] **Chain tasks** — `onSuccess: <task-id>` to trigger another task when this one succeeds
- [ ] **History view** — rolling table of all past runs, exit codes, and output previews
- [ ] **Export/import** — dump all tasks as JSON for backup or migration to another machine
- [ ] **Multi-machine sync** — store `tasks.json` in a git repo or iCloud for sharing scheduled tasks across machines
