# ADR-0007: Non-blocking UI refresh via worker threads and shared task state
Date: 2026-04-01
Status: Accepted

## Context

The TUI polls task state every few seconds. Each poll calls `loadTasks()`, which synchronously:

- Runs `plutil` (via `spawnSync`) once per plist to parse task config
- Runs `launchctl print` (via `spawnSync`) once per task to get live status
- Reads run history files from `~/.tide/tasks/<id>/runs/`

All of this blocks the Node.js event loop. Because Ink's render loop runs on the same thread, every scheduled refresh caused a visible freeze — the UI became unresponsive for the duration of the subprocess calls.

A second problem: `TaskDetailScreen` called `useTask()` independently, spawning its own poll loop. Navigating from the list to the detail screen always triggered a fresh `loading` state and showed a spinner, even though the task data was already in memory in `TaskListScreen`.

## Decision

**Worker thread for polling:** `loadTasks()` is extracted to `src/lib/load-tasks.js` and executed in a `worker_threads` Worker (`src/lib/tasks-worker.js`). The worker spawns, runs all the blocking subprocess calls, posts the result back to the main thread, and exits. The main thread only receives the final serialized task array — no blocking.

If a worker is still running when the next poll interval fires, the tick is skipped rather than spawning a concurrent worker. The worker is terminated on unmount.

**Shared task state hoisted to `App`:** `useTasks` is called once in `App` and the resulting `{ tasks, loading, error, refresh, intervalMs }` is passed as props to all screens. `TaskDetailScreen` finds its task via `tasks.find(t => t.id === taskId)` — instant lookup from the already-loaded array, no separate hook, no separate worker, no spinner on navigation.

The loading spinner in `TaskDetailScreen` is shown only when `loading && !task` — i.e. the very first cold-start before any data arrives. Subsequent navigations render immediately with the cached data.

## Consequences

- The main thread (and Ink render loop) is never blocked by subprocess calls.
- Navigating between list and detail is instantaneous — no re-fetch, no spinner.
- There is one refresh cycle shared across all screens; background screens don't poll independently.
- Worker startup has a small overhead (~10–30ms) per poll cycle, negligible compared to the subprocess time it replaces.
- `useTask` (single-task hook) is no longer used. It remains in `useTasks.js` but is dead code — can be removed if no future use is found.
