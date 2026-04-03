# Task Model

Each task is authored as a markdown file at `<repo>/.tide/<taskname>.md`. The plist at `~/Library/LaunchAgents/com.tide.<id>.plist` is the only derived artifact.

## Markdown file structure

```markdown
---
_id: 3f640f65
_createdAt: 2026-03-29T10:00:00Z
_jitter: 42
_enabled: true
name: Daily standup summary
schedule: 1h
workingDirectory: ~/projects/myrepo
agentAuth:
  strategy: tsh-okta-bedrock
  app: n26-dev-eu
  awsRole: bedrock-developer-user
  teleportProxy: teleport.access26.de:443
  model: arn:aws:bedrock:eu-central-1:538639307912:application-inference-profile/xswegkx4emk1
---

Summarize git log from the last 24h in /path/to/repo and list any open PRs.
```

The file **body** (below the `---`) is the prompt sent to Claude.

## Frontmatter fields

### User-authored fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `name` | `string` | filename (no `.md`) | Human-readable label shown in the TUI. |
| `schedule` | `string` | — | Interval shorthand (`15m`, `30m`, `1h`, `2h`, `6h`, `12h`, `24h`) or raw seconds. Use `manual` for no automatic schedule. |
| `workingDirectory` | `string` | settings default or `~` | Directory the task runs in. `~` is expanded. |
| `env` | `object` | `{}` | Additional environment variables passed to the run. |
| `resultRetentionDays` | `number` | `30` | Run history older than this is pruned after each run. |
| `timeoutSeconds` | `number` | none | Hard timeout passed to launchd. Includes jitter. |
| `enabled` | `boolean` | `true` | Initial enabled state when first synced. After that, use `[t]` in the TUI. |
| `agentAuth` | `object` | settings default | Auth configuration for the agent runner. See below. |

### `agentAuth` fields

| Field | Type | Description |
|-------|------|-------------|
| `strategy` | `string` | Auth strategy to use. Currently only `tsh-okta-bedrock`. |
| `app` | `string` | Teleport application name passed to `tsh aws --app`. |
| `awsRole` | `string` | AWS role passed to `tsh aws --aws-role`. |
| `teleportProxy` | `string` | Teleport proxy address passed to `tsh aws --proxy`. |
| `model` | `string` | Bedrock inference profile ARN used as the Claude model. |

::: tip Default agentAuth in settings
Add an `agentAuth` block to `~/.tide/settings.json` to avoid repeating it in every task file. Task frontmatter overrides it entirely when present.
:::

### Internal underscore-prefixed fields (managed by Tide — do not edit)

| Field | Description |
|-------|-------------|
| `_id` | Random 8-char hex ID. Immutable after creation. |
| `_createdAt` | ISO 8601 creation timestamp. Used for UI ordering. |
| `_jitter` | Random delay (0–min(interval/4, 300)s) applied before each run. Assigned once at creation. |
| `_enabled` | Current enabled state. Updated by `[t]` toggle in the TUI. |

## Which fields require a sync step

Only fields encoded in the plist need a rewrite to take effect. Other fields are read from the `.md` at runtime.

| Field changed | Requires sync (`[s]`)? |
|---------------|----------------------|
| `schedule` | Yes |
| `workingDirectory` | Yes |
| `env` | Yes |
| `timeoutSeconds` | Yes |
| `_enabled` | Yes (controls plist registration) |
| `name`, `argument` (body), `agentAuth`, `resultRetentionDays` | No — takes effect at next run |

## Task state at display time

The TUI assembles what you see from two sources, polled in a background worker thread on every refresh:

| Displayed field | Source |
|----------------|--------|
| `name`, `schedule`, `agentAuth`, etc. | `.md` frontmatter |
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
