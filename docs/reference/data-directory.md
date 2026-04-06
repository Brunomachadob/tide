# Data Directory

All Tide runtime data lives in `~/.tide/`.

## Structure

```
~/.tide/
├── settings.json
├── notifications.json
└── tasks/
    └── <id>/
        ├── running.pid          — present only while a run is active
        └── runs/
            └── <runId>/         — short hex ID, e.g. a3f9c1b2
                ├── run.json
                ├── output.log
                └── stderr.log
```

Task configuration lives in the repository, not in `~/.tide/`:

```
<repo>/.tide/
└── <taskname>.md    — source of truth for task config + prompt
```

## Files

### `~/.tide/settings.json`

Global settings — refresh interval and agent profiles.

```json
{
  "refreshInterval": 5,
  "profiles": {
    "claude-code": { "agent": "claude-code" },
    "gemini": { "agent": "gemini", "model": "gemini-2.5-pro" }
  }
}
```

### `~/.tide/notifications.json`

Array of notification entries for completed runs not yet reviewed. Appended to after each run, cleared when you open the Notifications screen and press `c`.

Does not exist until the first task run completes.

### `~/.tide/tasks/<id>/runs/<runId>/run.json`

Metadata for a single run. Written twice: once at start (with `runId`, `taskId`, `taskName`, `startedAt`), and again at completion with the full record including `completedAt`, `exitCode`, and `attempts`.

A run directory without a `completedAt` field indicates an in-progress or interrupted run.

```json
{
  "runId": "a3f9c1b2",
  "taskId": "3f640f65",
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

Tide writes a plist to `~/Library/LaunchAgents/` for each enabled task:

```
~/Library/LaunchAgents/
└── com.tide.<id>.plist   — one per enabled task
```

These are derived artifacts — generated from the source `.md` file. Each plist contains a `TIDE_TASK_FILE` env var pointing back to the `.md` file, which is how `tide.sh` finds the task config at runtime.

## Backup and migration

To back up all task run history:

```sh
cp -r ~/.tide ~/tide-backup
```

Task definitions live in your repos (`.tide/*.md`) and are versioned with git. After restoring `~/.tide/` on a new machine, tasks will show as `not loaded` (no plists). Re-enable each task from the TUI to regenerate and register the plists.

::: tip Task definitions are in git
The prompts and scheduling config for each task live in the `.tide/` directory of your repos — commit them to git for version control and portability.
:::
