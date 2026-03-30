# Logs & Results

## Results

Each task run writes a structured JSON result file:

```
~/.tide/tasks/<id>/results/<timestamp>.json
```

### Result schema

```json
{
  "exitCode": 0,
  "startedAt": "2026-03-30T10:00:00Z",
  "finishedAt": "2026-03-30T10:00:45Z",
  "attempts": 1
}
```

| Field | Description |
|-------|-------------|
| `exitCode` | Shell exit code. `0` = success, non-zero = failure |
| `startedAt` | ISO 8601 timestamp when the task started (after jitter) |
| `finishedAt` | ISO 8601 timestamp when the task completed |
| `attempts` | Total number of runs. `1` = ran once, `2` = initial run + 1 retry |

### Viewing results

Press `r` on a selected task in the task list to open the Results screen. Results are shown newest-first.

### Retention

Results older than `resultRetentionDays` are pruned after each run. The default retention period is 30 days.

To change retention, edit `task.json` directly:

```json
"resultRetentionDays": 7
```

## Logs

Each task has two log files:

```
~/.tide/tasks/<id>/logs/output.log   — combined stdout + stderr
~/.tide/tasks/<id>/logs/stderr.log   — stderr only
```

### Viewing logs

Press `l` on a selected task to open the Logs screen. You can switch between `output.log` and `stderr.log` with the Tab key.

Logs accumulate across runs — there is no per-run separation in the log files. Use the timestamps written at run boundaries to navigate:

```
[2026-03-30T10:00:00Z] Starting run...
...output...
[2026-03-30T10:00:45Z] Run complete (exit 0)
```

### Log rotation

Logs are rotated after each run if they exceed **5 MB**. Rotation keeps the most recent 2 MB of content.

::: info Why 5 MB?
The log rotation threshold balances keeping enough context for debugging against not letting log files grow unboundedly. For most use cases (LLM output, health check summaries), 5 MB is several weeks of history.
:::

### Gotcha: log files don't reset between runs

All runs append to the same `output.log`. If your command is verbose and runs frequently, logs grow quickly. If you need per-run logs, redirect output in your command:

```
/my/script.sh >> /tmp/my-task-$(date +%s).log 2>&1
```

Or set a short `resultRetentionDays` to keep the overall footprint small and rely on result JSON instead of logs.
