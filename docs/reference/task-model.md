# Task Model

Each task is stored as `~/.tide/tasks/<id>/task.json`.

## Full schema

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
  "env": {},
  "resultRetentionDays": 30
}
```

## Field reference

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Random 8-char hex ID. Immutable after creation. |
| `name` | `string` | Human-readable label shown in the TUI. |
| `argument` | `string` | Appended as the final argument to the run command. |
| `command` | `string` | *(optional)* Per-task command override. Falls back to `settings.json` command. |
| `extraArgs` | `string[]` | Additional arguments inserted between `command` and `argument`. |
| `schedule.type` | `"interval"` | Always `"interval"` — the only supported type. |
| `schedule.intervalSeconds` | `number` | Seconds between runs. |
| `jitterSeconds` | `number` | Random delay (0–min(interval/4, 300)s) applied before each run. Assigned at creation, immutable. |
| `createdAt` | `ISO 8601` | Creation timestamp. |
| `enabled` | `boolean` | Whether launchd has the task registered. `false` = no plist registered, task will not fire. |
| `maxRetries` | `number` | Extra retry attempts on non-zero exit. `0` = no retries. |
| `workingDirectory` | `string` | Directory the command runs in. Falls back to settings default. |
| `env` | `object` | Additional environment variables passed to the command. |
| `resultRetentionDays` | `number` | Results older than this are pruned after each run. Default: `30`. |

## Task state at display time

The TUI assembles what you see from three sources:

| Displayed field | Source |
|----------------|--------|
| `name`, `schedule`, `command`, etc. | `task.json` |
| `status` (disabled / loaded / running / not loaded) | `launchctl print` via `getStatus()` |
| `lastResult` (exit code, timestamps, output) | Newest file in `results/` |

If launchd has no record of the task (plist missing or never bootstrapped), `getStatus()` returns `{ loaded: false }` and the task shows as `not loaded`. This is not an error — you can re-enable the task from the UI to regenerate and re-register the plist.

## The plist

Each task has a corresponding plist at `~/Library/LaunchAgents/com.tide.<id>.plist`. This is a **derived artifact** — it is generated from `task.json` and can always be regenerated. See [ADR-0002](/adr/0002-task-json-as-source-of-truth).

The plist calls `task-runner.sh <id>` on the configured `StartInterval`.

::: warning Don't edit the plist directly
Any manual edits to the plist will be overwritten the next time you edit or re-enable the task via the TUI. Make config changes through Tide or by editing `task.json` directly (then toggle disable/enable to regenerate the plist).
:::
