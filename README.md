# Tide

Tide is a macOS task scheduler with a terminal UI. Define a command and a schedule, and Tide runs it in the background — whether you're at your desk or not. Think of it as a personal cron, but one you can actually manage without editing files.

## Why This Exists

Claude Code has a built-in scheduler (`CronCreate`/`CronDelete`) but it only fires jobs during an **active Claude REPL session**. The moment you close Claude, all scheduled tasks stop.

Tide solves this by using **macOS launchd** (`~/Library/LaunchAgents`) as the execution engine. Jobs fire on schedule regardless of whether Claude is open, similar to how cron jobs work.

### Use Cases

- Daily summaries (git log, open PRs, ticket status)
- Recurring code generation or analysis tasks
- Automated health checks that report back to you
- Any "run a command on a schedule" scenario

### Limitations

**macOS sleep:** launchd catches up on wake — if the interval has elapsed while the machine was asleep, the task fires once immediately on wake. A per-task jitter (randomly assigned at creation) spreads tasks out so they don't all fire simultaneously after wake.

### Notification Design

Completed tasks are never silently discarded. Each run appends an entry to `pending-notifications.json` and fires a native macOS notification. Open Tide to review results and clear pending notifications.

## Usage

Launch with:

```sh
npx github:Brunomachadob/tide
```

| Screen | What you can do |
|--------|----------------|
| Task list | View all tasks, their schedule, status, and last result |
| Task detail | See full config and live launchd status |
| Create task | Name, argument, schedule, working directory |
| Logs | Tail stdout/stderr for any task |
| Results | Browse structured execution results |
| Notifications | Review and clear completed-run summaries |
| Settings | Run command, working directory, date format |

## Configuration

The **run command** in Settings is the full command Tide will invoke, with the argument appended as the final argument. Example:

```
/opt/homebrew/bin/claude --permission-mode bypassPermissions -p
```

## Task Data Model

```json
{
  "id": "3f640f65",
  "name": "Daily standup summary",
  "argument": "Summarize git log from the last 24h in /path/to/repo and list any open PRs",
  "command": "/opt/homebrew/bin/claude --permission-mode bypassPermissions -p",
  "extraArgs": [],
  "schedule": { "type": "interval", "intervalSeconds": 3600 },
  "jitterSeconds": 42,
  "createdAt": "2026-03-29T10:00:00Z",
  "enabled": true,
  "maxRetries": 0,
  "workingDirectory": "/Users/you",
  "env": {}
}
```

Schedule type: `interval` — `{ type, intervalSeconds }` — fires every N seconds after the previous run. A random `jitterSeconds` (0–min(interval/4, 300)) is assigned at creation time to spread tasks out after a wake from sleep.

## Data Directory

All data lives in `~/.tide/`:

```
~/.tide/
  settings.json
  pending-notifications.json
  tasks/
    <id>/
      task.json
      logs/
      results/
```

---

## TODO / Future Improvements

### Features
- [ ] **Chain tasks** — `onSuccess: <task-id>` to trigger another task on success
- [ ] **Export/import** — dump all tasks as JSON for backup or migration

