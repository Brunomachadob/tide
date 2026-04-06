# ADR-0007: Multi-repo scope and task discovery
Date: 2026-04-02
Status: Accepted

## Context

ADR-0005 established that task files live in `<repo>/.tide/` and are discovered globally via `com.tide.*.plist` files, each carrying a `TIDE_TASK_FILE` pointer back to its source `.md`. This works well for running tasks, but two problems emerged:

1. **Scope detection was cwd-only.** `findRepoRoot` only checked the exact `process.cwd()` directory — it didn't walk up to the git root. Running Tide from a subdirectory silently disabled sync detection for that repo.

2. **Pending creates were single-repo.** `computePending` only scanned `.md` files under the cwd-derived repo root. Tasks moved to a different `.tide/` directory (or placed in a bare `.tide/` directory with no `.git`) never appeared as pending creates, making it impossible to register them from the UI.

3. **Orphaned tasks were invisible.** When a plist's `TIDE_TASK_FILE` no longer existed (e.g. after moving a `.md` file), `readTasks()` returned `null` for that entry and it was filtered out — the user had no way to clean up the stale plist.

4. **No repo context in the UI.** When viewing tasks from multiple repos in the list, there was no visual indication of which repo each task belonged to.

## Decision

### 1. `findRepoRoot` walks up to `.tide/`, stops at `.git`

Walk up from `cwd` looking for a `.tide/` directory. Stop if a `.git` boundary is crossed without finding one. This handles:
- Subdirectory launches within a git repo
- Bare `.tide/` directories outside of any git repo (e.g. `~/tasks/.tide/`)

### 2. `computePending` scans all known `.tide/` roots

In addition to the cwd-derived `repoRoot`, `computePending` collects all `.tide/` roots inferred from existing plists' `TIDE_TASK_FILE` paths (`path.dirname(path.dirname(TIDE_TASK_FILE))`). This makes pending-create detection global — the same scope as orphan detection — so tasks moved between repos always appear correctly.

### 3. Orphaned tasks appear in the task list

`loadTasks()` now adds ghost entries for orphans (in addition to pending-creates). An orphan is rendered with `syncStatus: 'orphan'` and can be synced away with `[Ctrl+S]` or `[S]`.

### 4. Scope selector in the TUI header

The task list header shows the current scope as a subtitle (`▾ <repo-name>` or `▾ all repos`). `Tab` cycles through all known repo roots (derived from task `sourcePath` fields) followed by "all repos". The toggle is hidden when only one scope exists.

When viewing "all repos", tasks are grouped visually by repo with a section header between groups — no REPO column in the row itself.

## Consequences

- Tide can be launched from any subdirectory of a git repo and will detect its `.tide/` correctly.
- Moving `.md` files between `.tide/` directories produces the expected orphan + pending-create pair in a single poll cycle.
- A bare `.tide/` directory (no `.git` ancestor) is a valid task root.
- Sync detection is fully global; no `.tide/` root is ever missed after its first task is registered.
- The UI always shows which repo a task belongs to when multiple repos are visible.
