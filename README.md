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

**macOS sleep affects calendar and interval tasks differently:**

- **Calendar tasks** (`StartCalendarInterval`): if your Mac is asleep at the scheduled time, that run is skipped entirely — no catch-up on wake.
- **Interval tasks** (`StartInterval`): launchd catches up on wake — if the interval has elapsed while the machine was asleep, the task fires once immediately on wake.

### Notification Design

Completed tasks are never silently discarded. Each run appends an entry to `pending-notifications.json` and fires a native macOS notification. Open Tide to review results and clear pending notifications.

## Usage

Launch with:

```sh
npx .
```

| Screen | What you can do |
|--------|----------------|
| Task list | View all tasks, their schedule, status, and last result |
| Task detail | See full config and live launchd status |
| Create task | Name, prompt, schedule, working directory |
| Logs | Tail stdout/stderr for any task |
| Results | Browse structured execution results |
| Notifications | Review and clear completed-run summaries |
| Settings | Run command, working directory, date format, timezone |

## Configuration

The **run command** in Settings is the full command Tide will invoke, with the prompt appended as the final argument. Example:

```
/opt/homebrew/bin/claude --permission-mode bypassPermissions -p
```

## Task Data Model

```json
{
  "id": "3f640f65",
  "name": "Daily standup summary",
  "prompt": "Summarize git log from the last 24h in /path/to/repo and list any open PRs",
  "command": "/opt/homebrew/bin/claude --permission-mode bypassPermissions -p",
  "extraArgs": [],
  "schedule": {
    "type": "calendar",
    "hour": 9,
    "minute": 0
  },
  "createdAt": "2026-03-29T10:00:00Z",
  "enabled": true,
  "maxRetries": 0,
  "workingDirectory": "/Users/you",
  "env": {}
}
```

Schedule types:
- `calendar` — `{ type, hour, minute, days? }` → fires at a specific time (optionally on specific weekdays)
- `interval` — `{ type, intervalSeconds }` → fires every N seconds

## Data Directory

All data lives in `~/.tide/`:

```
~/.tide/
  settings.json
  pending-notifications.json
  tasks/
    <id>/
      task.json
      prompt.txt
      logs/
      results/
```

---

## TODO / Future Improvements

### UX
- [ ] **Natural language schedule parsing** — accept "every weekday at 9am", "every Monday", "twice a day"
- [ ] **Status dashboard** — show all tasks with next scheduled fire time and a sparkline of last 10 exit codes
- [ ] **Pause task** — temporarily suspend a task for N hours/days without deleting it

### Reliability
- [x] **Max log size rotation** — cap `output.log` at 5MB with automatic rotation
- [x] **Result retention policy** — auto-prune result JSON files older than N days (configurable per task)
- [x] **Task timeout** — `timeoutSeconds` field uses launchd's `TimeOut` key to kill hung tasks
- [x] **Overlapping run detection** — PID file prevents concurrent runs of the same task

### Notifications
- [x] **macOS native notification** — fires on task completion

### Features
- [ ] **Output post-processing** — optional `outputFile` field to write output to a specific file
- [ ] **Chain tasks** — `onSuccess: <task-id>` to trigger another task on success
- [ ] **Export/import** — dump all tasks as JSON for backup or migration

### Code Quality
- [ ] **Convert to JSX** — all screens use `React.createElement()` directly; adding a build step (e.g. esbuild) would allow JSX and make the UI code significantly more readable
- [ ] **Fix missing `path` import in `TaskListScreen`** — `path.join()` is called on delete but `path` is never imported; currently masked because delete hasn't been exercised in tests
- [ ] **Remove unused `os` imports** — `CreateTaskScreen`, `TaskDetailScreen`, `TaskListScreen`, and `SettingsScreen` all import `os` but don't use it
- [ ] **Replace `createRequire` in `App.js`** — the only file still using `createRequire` + `require('fs')` instead of `import fs from 'fs'`
