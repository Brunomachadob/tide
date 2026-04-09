# Tide — Claude Code Notes

User-facing docs live in `docs/` and are published to https://brunomb.com/tide/ via VitePress. The README links to them. After any code change, check whether the affected area is documented in `docs/guide/` or `docs/reference/` and update those pages if they are now inaccurate.

## Git workflow

**Main is protected — all changes must go through a branch and PR.**

1. Create a branch: `git checkout -b <short-description>`
2. Make changes, commit
3. Push and open a PR: `gh pr create`
4. The `test` CI check must pass before merging

## Architecture

### Runtime flow

A task's lifecycle involves three distinct layers:

1. **launchd** — owns scheduling and process execution. Each task is a plist in `~/Library/LaunchAgents/`. launchd fires `scripts/tide.sh <id>` on schedule.
2. **tide.sh** — thin shell wrapper. Reads `agentAuth` from the task frontmatter and hands off to `scripts/agent-runner.js` via `tsh aws --exec node`.
3. **agent-runner.js** — owns the full run lifecycle: PID check, jitter, SDK query via `@anthropic-ai/claude-agent-sdk`, output streaming, `run.json`, notifications, log rotation, run retention.
4. **TUI** (`src/`) — polls task state on an interval via a background worker thread. Never writes to launchd directly except on create/enable/disable/delete.

### Task data assembly

What the UI shows for each task is assembled from two sources at display time (see `src/lib/load-tasks.js`):

| Field | Source |
|---|---|
| Config (`name`, `schedule`, `agentAuth`, etc.) | `<repo>/.tide/<task>.md` frontmatter + body |
| `status` (disabled / loaded / running / not loaded) | `launchctl print` via `getStatus()` |
| `lastResult` (exit code, timestamps, output) | latest run in `~/.tide/tasks/<id>/runs/` |

`readTasks()` scans `~/Library/LaunchAgents/com.tide.*.plist` files. Each plist contains a `TIDE_TASK_FILE` env var pointing back to the source `.md` file.

If launchd has no record of the task (plist missing or never bootstrapped), `getStatus()` returns `{ loaded: false }` and the task shows as `not loaded` — it does not crash or disappear. The user can re-enable it from the UI.

### UI refresh model

`loadTasks()` calls `spawnSync` (for `plutil` and `launchctl`) and reads files synchronously — it would block the Node.js event loop and freeze Ink's render loop if run on the main thread. Instead:

- `useTasks` (in `App`) spawns a `worker_threads` Worker per poll cycle. The worker runs `loadTasks()`, posts the result back, and exits. The main thread is never blocked.
- If a worker is still running when the next interval fires, the tick is skipped.
- The resulting `tasks` array is held in `App` state and passed as props to all screens. `TaskDetailScreen` looks up its task via `tasks.find()` — no separate poll loop, no spinner on navigation.

### Module responsibilities

```
src/lib/
  io.js           — safeReadJSON, atomicWriteJSON (shared primitives)
  tasks.js        — readTask/readTasks scan plists + .md files; setEnabled rewrites plist
  results.js      — read result JSON files
  logs.js         — read stdout/stderr/output log files
  notifications.js — read/clear pending-notifications.json
  settings.js     — read/write ~/.tide/settings.json
  format.js       — formatDate, formatRelativeTime, formatSchedule (pure, no I/O)
  launchd.js      — launchctl wrappers (getStatus, bootstrap, bootout, kickstart)
  create.js       — createTask: writes underscore-prefixed internal fields to .md + generates plist, calls bootstrap
  taskfile.js     — parseTaskFile, writeTideFields, computePending, applyPending
  load-tasks.js   — loadTasks(): merges .md + launchd + lastResult into display objects (run in worker)
  tasks-worker.js — worker thread entry point: calls loadTasks(), posts result to main thread
  constants.js    — parseSchedule, LAUNCH_AGENTS_DIR

scripts/
  tide.sh         — executed by launchd; resolves agentAuth, execs into tsh aws --exec node agent-runner.js
  agent-runner.js — full run lifecycle: PID check, jitter, SDK call, run.json, notifications, log rotation

src/hooks/
  useTasks.js         — spawns worker per tick; holds shared task list in App
  useResults.js       — polls getResults()
  useLogs.js          — polls log files
  useNotifications.js — polls pending-notifications.json
```

### Key invariants

- The `.md` file in `<repo>/.tide/` is the source of truth for task config. The plist is derived from it.
- Underscore-prefixed frontmatter keys (`_id`, `_createdAt`, `_jitter`) are managed by Tide. User keys have no prefix.
- `task.json` is no longer written or read.
- Only plist-encoded fields (`schedule`, `workingDirectory`, `env`, `timeoutSeconds`) require a sync step. Other field changes take effect at the next run.
- Enabled/disabled state is derived from the plist's `Disabled` key — it is not stored in the `.md` file.
- `readTasks()` has no side effects — it does not create `pending-notifications.json`. That file is created by `agent-runner.js` (post-run).
- The `attempts` field in run.json is the total number of runs (1 = ran once, 2 = ran + 1 retry).

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
- `tide.sh` tests are macOS/zsh-only (matching the project's target platform). Retry backoff tests are omitted because the hardcoded `sleep` would make them prohibitively slow.
