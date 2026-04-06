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
  "attempts": 1,
  "argument": "the prompt used for this run",
  "parentRunId": "de45f012"
}
```

| Field | Description |
|-------|-------------|
| `runId` | 8-char random hex ID unique to this run |
| `startedAt` | ISO 8601 timestamp written immediately when the run starts |
| `completedAt` | ISO 8601 timestamp written when the run finishes. Absent if the run is in progress or was killed |
| `exitCode` | Shell exit code. `0` = success, non-zero = failure |
| `attempts` | Total number of attempts. `1` = ran once, `2` = initial run + 1 retry |
| `argument` | The argument (prompt) used for this run, snapshotted at start time |
| `parentRunId` | Present only on follow-up runs. The `runId` of the run this was spawned from |

`run.json` is written twice: once at start (with `runId`, `taskId`, `taskName`, `startedAt`, `argument`, and `parentRunId` if applicable) and again at completion with the full record. This means a run directory always exists as proof-of-start, even if the process was killed.

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

Press `f` to start a **follow-up run** — see [Follow-up runs](#follow-up-runs) below.

Press `Ctrl+F` to toggle **auto-refresh** — useful when watching a run in progress. Auto-refresh is enabled automatically when viewing the latest run of a currently-running task.

If a run is a follow-up, its detail view shows `↳ follow-up of <parentRunId>` in the header.

Press `←` / `Esc` / `q` to go back to the run list.

## Follow-up runs

A follow-up run lets you continue a conversation where a previous run left off, passing its full output as context for the next prompt.

### How it works

1. Open any run in the Run detail view and press `f`.
2. Tide opens the **New Task** screen with the **Argument** field pre-filled with the previous run's argument and its complete output, separated by a newline:
   ```
   <previous argument>
   <previous output>
   ```
3. Edit the pre-filled argument — typically by appending your new prompt at the end — then complete the task creation flow as normal.
4. The new task is created with a `parentRunId` field that links it back to the source run.

### parentRunId and run graph

Every follow-up task's `run.json` contains a `parentRunId` field pointing to the `runId` it was spawned from. This creates a traceable chain: you can reconstruct the full conversation history by following `parentRunId` links back through previous runs.

Follow-up runs are visually identified in the run list and detail view with the `↳ follow-up of <parentRunId>` indicator.

## Log rotation

Each run's logs are rotated after the run completes if they exceed **5 MB**. Rotation keeps the most recent 2 MB of content and prepends a `[... rotated ...]` marker.

## Retention

Run directories older than `resultRetentionDays` are deleted after each run. The default is 30 days.

To change retention per task, edit `task.json` directly:

```json
"resultRetentionDays": 7
```
