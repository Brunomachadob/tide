# Task Model

Each task is authored as a markdown file at `<workspace>/.tide/<taskname>.md`. The plist at `~/Library/LaunchAgents/com.tide.<id>.plist` is the only derived artifact.

## Markdown file structure

```markdown
---
_id: 3f640f65
name: Daily standup summary
schedule: 1h
workingDirectory: ~/projects/myrepo
profile: my-claude
---

Summarize git log from the last 24h in /path/to/repo and list any open PRs.
```

The file **body** (below the `---`) is the prompt sent to Claude.

## Frontmatter fields

### User-authored fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `name` | `string` | filename (no `.md`) | Human-readable label shown in the TUI. |
| `schedule` | `string` | — | `Nm` (minutes), `Nh` (hours), `Nd` (days), or a plain integer (seconds). E.g. `30m`, `6h`, `7d`, `90`. Use `manual` for no automatic schedule. |
| `workingDirectory` | `string` | settings default or `~` | Directory the task runs in. `~` is expanded. |
| `env` | `object` | `{}` | Additional environment variables passed to the run. |
| `resultRetentionDays` | `number` | `30` | Run history older than this is pruned after each run. |
| `timeoutSeconds` | `number` | none | Per-attempt timeout enforced by the agent runner. When elapsed, the process is sent SIGTERM and exits with code 124. |
| `maxRetries` | `number` | `0` | Number of retries on non-zero exit, with linear backoff (30s × attempt). |
| `profile` | `string` | — | Key referencing a profile in `~/.tide/settings.json` under `profiles`. |

::: tip Profiles live in settings
Profile configuration is stored once in `~/.tide/settings.json` under `profiles` and referenced by name in task frontmatter. See [Settings](/guide/settings#profiles).
:::

### Internal underscore-prefixed fields (managed by Tide — do not edit)

| Field | Description |
|-------|-------------|
| `_id` | Random 8-char hex ID. Immutable after creation. Links the `.md` file to its plist and run history. |

Jitter and creation time are stored as `TIDE_JITTER` and `TIDE_CREATED_AT` env vars in the plist, not in the `.md` file.

## Which fields require a sync step

Only fields encoded in the plist need a rewrite to take effect. Other fields are read from the `.md` at runtime.

| Field changed | Requires sync (`[s]`)? |
|---------------|----------------------|
| `schedule` | Yes |
| `workingDirectory` | Yes |
| `env` | Yes |
| `timeoutSeconds` | Yes |
| `name`, body, `profile`, `resultRetentionDays`, `maxRetries` | No — takes effect at next run |

## Task state at display time

The TUI assembles what you see from two sources, polled in a background worker thread on every refresh:

| Displayed field | Source |
|----------------|--------|
| `name`, `schedule`, `profile`, etc. | `.md` frontmatter |
| `status` (disabled / loaded / running / not loaded) | `launchctl print` via `getStatus()` |
| `lastResult` (exit code, timestamps, output) | Latest run in `~/.tide/tasks/<id>/runs/` |

The assembled task list is held in memory in `App` and shared across all screens — navigating to the detail view is instant, with no re-fetch.

If launchd has no record of the task (plist missing or never bootstrapped), `getStatus()` returns `{ loaded: false }` and the task shows as `not loaded`. Re-enable it from the TUI to regenerate and re-register the plist.

## The plist

Each task has a corresponding plist at `~/Library/LaunchAgents/com.tide.<id>.plist`. This is a **derived artifact** — generated from the `.md` file and regenerated on each sync.

The plist includes a `TIDE_TASK_FILE` environment variable pointing back to the source `.md` file. `tide.sh` reads this at runtime.

::: warning Don't edit the plist directly
Any manual edits will be overwritten the next time you sync the task from the TUI.
:::
