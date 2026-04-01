# Phase 2: Plist as derived artifact, task.json removed

## Status: Future — not yet implemented

This document describes the next evolution of Tide's task storage model, building on ADR-0006.

---

## Goal

Remove `task.json` entirely. The markdown file remains the source of truth, but instead of syncing through an intermediate `task.json`, changes are diffed directly against the launchd plist and applied in one step.

```
<repo>/.tide/<task>.md  ──sync──►  ~/Library/LaunchAgents/com.tide.<id>.plist
                                                ↓
                                    tide.sh reads TIDE_TASK_FILE env var
                                    → reads .md directly at runtime
```

---

## Key changes from Phase 1

### Remove `task.json`

`task.json` is no longer written. `readTasks()` is replaced by a scan of all `~/Library/LaunchAgents/com.tide.*.plist` files. Each plist contains a `TIDE_TASK_FILE` env var pointing back to the source `.md` file.

```xml
<key>TIDE_TASK_FILE</key>
<string>/Users/you/myproject/.tide/daily-standup.md</string>
```

At display time, `readTasks()` reads each `.md` file for config, and `~/.tide/tasks/<id>/` for run history.

### Rewrite `task-setup.js`

Instead of reading `task.json`, reads `TIDE_TASK_FILE` (passed by launchd via env). Parses the YAML frontmatter using `gray-matter` (already a dependency). The `argument`/body is written to a temp file and passed to the command.

### Sync: diff frontmatter vs plist

On each refresh, for every `com.tide.*.plist`:
1. Read `TIDE_TASK_FILE` from plist env vars
2. Check `fs.existsSync(TIDE_TASK_FILE)` — if missing, mark `orphaned`
3. Parse frontmatter from the `.md` file
4. Compare to plist fields using regex on known patterns:
   - `<key>StartInterval</key>\n  <integer>(\d+)</integer>` → schedule
   - `<key>WorkingDirectory</key>\n  <string>(.*?)</string>` → workingDirectory
   - etc.
5. If any field differs → mark `pending-update`

Same pending states as Phase 1: `pending-create`, `pending-update`, `orphaned`. Same UI: badges in list, diff in detail screen, `[s]` to apply.

### Deletion detection becomes trivially global

Since the plist set covers all registered tasks across all repos, scanning all `com.tide.*.plist` files and checking `existsSync(TIDE_TASK_FILE)` catches deletions from any repo without needing `sourcePath` in a `task.json`.

### Cross-repo visibility without repos.json

`readTasks()` reads all plists globally. The `[f]` namespace filter derives the current repo root from `TIDE_TASK_FILE` paths matching `process.cwd()`'s git root.

---

## Files that change

| File | Change |
|------|--------|
| `src/lib/taskfile.js` | Replace `syncRepo`/`computePending` to diff against plist instead of task.json |
| `src/lib/tasks.js` | `readTasks()` rewritten to scan plists + read .md files |
| `src/lib/create.js` | `writePlist` updated to include `TIDE_TASK_FILE` env var |
| `scripts/task-setup.js` | Rewritten to read .md via `TIDE_TASK_FILE` instead of task.json |
| `scripts/task-postprocess.js` | Read task name/retention from .md frontmatter instead of task.json |
| `~/.tide/tasks/<id>/task.json` | No longer written (existing ones can be ignored/deleted) |

---

## Migration from Phase 1

No explicit migration needed. Existing `task.json` files can be left in place — they will simply be ignored once `readTasks()` switches to scanning plists. Run history in `~/.tide/tasks/<id>/runs/` is unaffected.

---

## Why not do this in Phase 1?

Phase 1 deliberately kept the shell scripts (`tide.sh`, `task-setup.js`, `task-postprocess.js`) unchanged to minimize the blast radius of the initial change. The `task.json` intermediate layer provides a stable interface for the execution pipeline while the UI and sync layers are rebuilt around markdown files.

Phase 2 completes the simplification: one less file format, one less sync step, and deletion detection that works globally without any bookkeeping.
