# Data Directory

All Tide data lives in `~/.tide/`.

## Structure

```
~/.tide/
├── settings.json
├── notifications.json
└── tasks/
    └── <id>/
        ├── task.json
        ├── running.pid          — present only while a run is active
        └── runs/
            └── <runId>/         — short hex ID, e.g. a3f9c1b2
                ├── run.json
                ├── output.log
                └── stderr.log
```

## Files

### `~/.tide/settings.json`

Global settings — run command, default working directory, date format.

```json
{
  "command": "/opt/homebrew/bin/claude --permission-mode bypassPermissions -p",
  "workingDirectory": "/Users/you",
  "dateFormat": "YYYY-MM-DD"
}
```

### `~/.tide/notifications.json`

Array of notification entries for completed runs not yet reviewed. Appended to after each run, cleared when you open the Notifications screen and press `c`.

Does not exist until the first task run completes.

### `~/.tide/tasks/<id>/task.json`

The authoritative config for a task. See [Task Model](/reference/task-model) for full schema.

### `~/.tide/tasks/<id>/runs/<runId>/run.json`

Metadata for a single run. Written twice: once at start (with `runId`, `taskId`, `taskName`, `startedAt`), and again at completion with the full record including `completedAt`, `exitCode`, and `attempts`.

A run directory without a `completedAt` field in `run.json` indicates an in-progress or interrupted run.

```json
{
  "runId": "a3f9c1b2",
  "taskId": "...",
  "taskName": "My Task",
  "startedAt": "2026-03-30T10:00:00Z",
  "completedAt": "2026-03-30T10:00:45Z",
  "exitCode": 0,
  "attempts": 1
}
```

### `~/.tide/tasks/<id>/runs/<runId>/output.log`

stdout for this run only. Rotated at 5 MB (keeps last 2 MB).

### `~/.tide/tasks/<id>/runs/<runId>/stderr.log`

stderr for this run only. Same rotation behavior.

Run directories older than `resultRetentionDays` (default 30) are deleted after each run.

## LaunchAgents

Tide also writes to `~/Library/LaunchAgents/`:

```
~/Library/LaunchAgents/
└── com.tide.<id>.plist   — one per enabled task
```

These are derived artifacts — they can be regenerated from `task.json`. See [ADR-0002](/adr/0002-task-json-as-source-of-truth).

## Backup and migration

To back up all tasks:

```sh
cp -r ~/.tide ~/tide-backup
```

To restore on a new machine:

```sh
cp -r ~/tide-backup ~/.tide
```

After restoring, tasks will show as `not loaded` (launchd has no plists). Re-enable each task from the TUI to regenerate and register the plists.

::: tip Exporting tasks
Task data is plain JSON with no binary or platform-specific content. The `task.json` files can be versioned in git, synced via iCloud, or shared between machines.
:::
