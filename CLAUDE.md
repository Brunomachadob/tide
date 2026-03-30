# Tide — Claude Code Notes

User-facing docs live in `docs/` and are published to GitHub Pages via VitePress. The README links to them. After any code change, check whether the affected area is documented in `docs/guide/` or `docs/reference/` and update those pages if they are now inaccurate.

## Architecture

### Runtime flow

A task's lifecycle involves three distinct layers:

1. **launchd** — owns scheduling and process execution. Each task is a plist in `~/Library/LaunchAgents/`. launchd fires `scripts/task-runner.sh <id>` on schedule.
2. **task-runner.sh** — thin shell wrapper. Reads config via `task-setup.js`, runs the command with retry logic, then delegates all post-run work (result JSON, notifications, log rotation, retention) to `task-postprocess.js`.
3. **TUI** (`src/`) — reads `~/.tide/` on a polling interval and calls `launchctl print` per task to get live status. Never writes to launchd directly except on create/enable/disable/delete.

### Task data assembly

What the UI shows for each task is merged from three sources at display time (see `src/hooks/useTasks.js`):

| Field | Source |
|---|---|
| Config (`name`, `schedule`, `command`, etc.) | `~/.tide/tasks/<id>/task.json` |
| `status` (disabled / loaded / running / not loaded) | `launchctl print` via `getStatus()` |
| `lastResult` (exit code, timestamps, output) | latest `~/.tide/tasks/<id>/results/*.json` |

If launchd has no record of the task (plist missing or never bootstrapped), `getStatus()` returns `{ loaded: false }` and the task shows as `not loaded` — it does not crash or disappear. The user can re-enable it from the UI.

### Module responsibilities

```
src/lib/
  io.js           — safeReadJSON, atomicWriteJSON (shared primitives)
  tasks.js        — task CRUD against ~/.tide/tasks/
  results.js      — read result JSON files
  logs.js         — read stdout/stderr/output log files
  notifications.js — read/clear pending-notifications.json
  settings.js     — read/write ~/.tide/settings.json
  format.js       — formatDate, formatRelativeTime, formatSchedule (pure, no I/O)
  launchd.js      — launchctl wrappers (getStatus, bootstrap, bootout, kickstart)
  create.js       — createTask: writes task.json + prompt.txt + plist, calls bootstrap
  constants.js    — DATE_FORMATS, TIMEZONES

scripts/
  task-runner.sh        — executed by launchd; runs the command, handles retries
  task-setup.js         — reads task.json and emits shell variables before the run
  task-postprocess.js   — writes result JSON, notifications, rotates logs, prunes old results

src/hooks/
  useTasks.js       — polls loadTasks() (merges task.json + launchd + lastResult)
  useResults.js     — polls getResults()
  useLogs.js        — polls log files
  useNotifications.js — polls pending-notifications.json
```

### Key invariants

- `task.json` is the source of truth for task config. launchd's plist is derived from it and can be regenerated.
- All JSON writes use an atomic tmp-then-rename pattern (`atomicWriteJSON` in `io.js`).
- `readTasks()` no longer has side effects — it does not create `pending-notifications.json`. That file is created on first write by `task-postprocess.js` (post-run).
- The `attempts` field in result JSON is the total number of runs (1 = ran once, 2 = ran + 1 retry). The shell increments the counter before breaking on success or exhausting retries.

---

## Architecture Decision Records (ADRs)

ADRs live in `docs/adr/` and document significant architectural decisions — why they were made, what was considered, and what the consequences are.

### When to consult ADRs

Before planning or implementing any change that touches the architecture, **read the relevant ADRs first**. They capture constraints and tradeoffs that may not be obvious from the code alone. A plan that contradicts an existing ADR must explicitly address it.

### When to write an ADR

Write a new ADR whenever a plan involves:
- Changing a core architectural decision (scheduling model, config format, execution model, etc.)
- Introducing a new technology or runtime dependency
- Making a tradeoff that future maintainers would reasonably question

If the new decision supersedes an existing ADR, update the old ADR's status to `Superseded by ADR-NNNN` and link to the new one.

### ADR template

```markdown
# ADR-NNNN: Title
Date: YYYY-MM-DD
Status: Accepted | Superseded by [ADR-NNNN](NNNN-title.md)

## Context
Why this decision was needed — the problem, constraint, or question that prompted it.

## Decision
What was decided.

## Consequences
What this means going forward — both benefits and limitations.
```

Keep ADRs concise. The goal is to capture the *why*, not reconstruct every option considered. Only add an alternatives section if the tradeoffs were genuinely non-obvious.

---

## Testing

Uses Node's built-in test runner (`node:test`) — no extra dependencies. See [README.md](README.md) for data directory layout.

```
npm test
```

### Approach

- Each test file creates an isolated `mkdtemp` dir and sets `HOME` to it before importing the module under test — no test touches `~/.tide`.
- `src/lib` modules are imported with a `?bust=N` query string to get a fresh ESM module instance bound to the temp `HOME` (the static import at the top of the test file would otherwise capture the real home at load time).
- Script tests use `spawnSync` with `HOME` overridden and fake shell scripts as stand-ins for the real command.
- `task-runner.sh` tests are macOS/zsh-only (matching the project's target platform). Retry backoff tests are omitted because the hardcoded `sleep` would make them prohibitively slow.
