# Tide — Claude Code Notes

For user-facing docs, data model, and configuration see [README.md](README.md).

## Architecture

### Runtime flow

A task's lifecycle involves three distinct layers:

1. **launchd** — owns scheduling and process execution. Each task is a plist in `~/Library/LaunchAgents/`. launchd fires `scripts/task-runner.sh <id>` on schedule.
2. **task-runner.sh** — thin shell wrapper. Reads config via `task-postprocess.js config`, runs the command with retry logic, then delegates all post-run work (result JSON, notifications, log rotation, retention) to `task-postprocess.js post`.
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
  task-postprocess.js   — Node helper called by task-runner.sh for all JSON work

src/hooks/
  useTasks.js       — polls loadTasks() (merges task.json + launchd + lastResult)
  useResults.js     — polls getResults()
  useLogs.js        — polls log files
  useNotifications.js — polls pending-notifications.json
```

### Key invariants

- `task.json` is the source of truth for task config. launchd's plist is derived from it and can be regenerated.
- All JSON writes use an atomic tmp-then-rename pattern (`atomicWriteJSON` in `io.js`).
- `readTasks()` no longer has side effects — it does not create `pending-notifications.json`. That file is created on first write by `task-postprocess.js`.
- The `attempts` field in result JSON is the total number of runs (1 = ran once, 2 = ran + 1 retry). The shell increments the counter before breaking on success or exhausting retries.

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
