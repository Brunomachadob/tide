# Retries

## Configuration

Retries are handled by `agent-runner.js`. Set `maxRetries` in the task frontmatter. The default is `0` (no retries — run once and record the result).

| `maxRetries` | Behavior |
|-------------|---------|
| `0` | Run once. If it fails, record the failure and move on. |
| `1` | Run once. If it fails, try once more. |
| `N` | Run up to N+1 total times. |

## Backoff

Retries use **linear backoff**:

| Attempt | Delay before attempt |
|---------|---------------------|
| 1 (initial) | 0s (no delay) |
| 2 (retry 1) | 30s |
| 3 (retry 2) | 60s |
| 4 (retry 3) | 90s |
| … | +30s per retry |

On success the loop breaks immediately. On exhausting all retries, the final non-zero exit code is recorded.

## Result recording

The result JSON records the **total number of attempts**:

```json
{
  "exitCode": 0,
  "startedAt": "2026-03-30T10:00:00Z",
  "completedAt": "2026-03-30T10:00:45Z",
  "attempts": 2
}
```

`attempts: 2` means the task ran twice — it failed on the first try and succeeded on the second.

## When to use retries

Retries are useful for operations that can fail transiently:
- Network-dependent API calls
- Commands that require a service to be available (VPN, database)
- Bedrock calls that hit transient rate limits

For tasks that are expected to fail (e.g. a health check that should alert on failure), keep `maxRetries: 0` — retries would suppress the failure signal.

::: warning Retries extend run duration
A task with `maxRetries: 3` and backoff of 30s/60s/90s could run for several minutes before completing. launchd fires the next scheduled interval after the runner exits, so longer-running tasks effectively reduce their own run frequency.
:::
