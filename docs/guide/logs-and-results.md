# Runs

Each task execution is stored as a self-contained **run** under `~/.tide/tasks/<id>/runs/<runId>/`.

## Run storage

```
~/.tide/tasks/<id>/runs/
└── <runId>/               — short random hex ID (e.g. a3f9c1b2)
    ├── run.json           — metadata (written at start, completed at end)
    ├── output.log         — stdout for this run only
    └── stderr.log         — stderr for this run only
```

### run.json schema

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

| Field | Description |
|-------|-------------|
| `runId` | 8-char random hex ID unique to this run |
| `startedAt` | ISO 8601 timestamp written immediately when the run starts |
| `completedAt` | ISO 8601 timestamp written when the run finishes. Absent if the run is in progress or was killed |
| `exitCode` | Shell exit code. `0` = success, non-zero = failure |
| `attempts` | Total number of attempts. `1` = ran once, `2` = initial run + 1 retry |

`run.json` is written twice: once at start (with only `runId`, `taskId`, `taskName`, `startedAt`) and again at completion with the full record. This means a run directory always exists as proof-of-start, even if the process was killed.

## Viewing runs

Press `x` on a selected task (from the task list or task detail) to open the **Runs screen**.

### Runs list

Shows all runs for the task, newest first. Each row displays:
- Start time
- Exit code badge (green ✓ / red ✗ / spinner if in progress)
- Duration
- Attempt count (if > 1)

Use `+` / `-` to show more or fewer runs (5 / 10 / 25 / 50).

### Run detail

Press `Enter` or `→` on a run to open its detail view. This shows:
- Run metadata at the top (time, exit code, duration, attempts)
- Full log output for **that run only**, scoped to `output.log` / `stderr.log`

Press `Tab` to switch between OUTPUT and STDERR tabs.

Press `f` to toggle **auto-refresh** — useful when watching a run in progress. Auto-refresh is enabled automatically when viewing the latest run of a currently-running task.

Press `←` / `Esc` / `q` to go back to the run list.

## Log rotation

Each run's logs are rotated after the run completes if they exceed **5 MB**. Rotation keeps the most recent 2 MB of content and prepends a `[... rotated ...]` marker.

## Retention

Run directories older than `resultRetentionDays` are deleted after each run. The default is 30 days.

To change retention per task, edit `task.json` directly:

```json
"resultRetentionDays": 7
```
