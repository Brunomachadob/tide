# Data Directory

All Tide data lives in `~/.tide/`.

## Structure

```
~/.tide/
├── settings.json
├── pending-notifications.json
└── tasks/
    └── <id>/
        ├── task.json
        ├── logs/
        │   ├── output.log
        │   └── stderr.log
        └── results/
            ├── 2026-03-30T10-00-00Z.json
            └── 2026-03-29T10-00-00Z.json
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

### `~/.tide/pending-notifications.json`

Array of notification entries for completed runs not yet reviewed. Appended to after each run, cleared when you open the Notifications screen and press `c`.

Does not exist until the first task run completes.

### `~/.tide/tasks/<id>/task.json`

The authoritative config for a task. See [Task Model](/reference/task-model) for full schema.

### `~/.tide/tasks/<id>/logs/output.log`

Combined stdout + stderr from all runs. Runs append to this file. Rotated at 5 MB (keeps last 2 MB).

### `~/.tide/tasks/<id>/logs/stderr.log`

stderr-only log. Same rotation behavior.

### `~/.tide/tasks/<id>/results/<timestamp>.json`

One file per completed run. Filename is the ISO 8601 start timestamp with `:` replaced by `-` for filesystem compatibility.

```json
{
  "exitCode": 0,
  "startedAt": "2026-03-30T10:00:00Z",
  "finishedAt": "2026-03-30T10:00:45Z",
  "attempts": 1
}
```

Files older than `resultRetentionDays` are deleted after each run.

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
