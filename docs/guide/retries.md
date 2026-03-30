# Retries

## Configuration

Set `maxRetries` when creating or editing a task. The default is `0` (no retries — run once and record the result).

| `maxRetries` | Behavior |
|-------------|---------|
| `0` | Run once. If it fails, record the failure and move on. |
| `1` | Run once. If it fails, try once more. |
| `N` | Run up to N+1 total times. |

## Backoff

Retries use **fixed delay backoff**:

| Attempt | Delay before attempt |
|---------|---------------------|
| 1 (initial) | 0s (no delay) |
| 2 (retry 1) | 30s |
| 3 (retry 2) | 60s |
| 4 (retry 3) | 90s |
| … | +30s per retry |

The shell increments an attempt counter before each run. On success, the loop breaks immediately. On exhausting all retries, the final non-zero exit code is recorded.

## Result recording

The result JSON records the **total number of attempts**:

```json
{
  "exitCode": 0,
  "startedAt": "2026-03-30T10:00:00Z",
  "finishedAt": "2026-03-30T10:00:45Z",
  "attempts": 2
}
```

`attempts: 2` means the task ran twice — it failed on the first try and succeeded on the second.

## When to use retries

Retries are useful for commands that can fail transiently:
- Network-dependent operations (API calls, fetching remote data)
- Commands that require a service to be available (database, VPN)
- Claude CLI calls that may hit rate limits

For tasks that are expected to fail (e.g. a health check that should alert on failure), keep `maxRetries: 0` — retries would suppress the failure signal.

::: warning Retries extend run duration
A task with `maxRetries: 3` and backoff of 30s/60s/90s could run for up to 3 minutes before completing. launchd will fire the next scheduled interval from when `task-runner.sh` exits, so longer-running tasks effectively reduce their own run frequency.
:::
