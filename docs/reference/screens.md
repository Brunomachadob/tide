# Screens

## Task List (default)

The main screen. Shows all tasks with status, schedule, last result, and pending sync state.

### Scope selector

The header subtitle shows the current scope (`▾ <repo-name>` or `▾ all repos`). Press `Tab` to cycle through all known repos and "all repos". The selector is hidden when only one repo has tasks.

When multiple repos are visible ("all repos" mode), tasks are grouped by repo with a section header between groups.

**Keyboard shortcuts:**

| Key | Action |
|-----|--------|
| `↑` / `↓` / `j` / `k` | Navigate tasks |
| `Enter` | Open Task Detail |
| `Tab` | Cycle scope (current repo → other repos → all repos) |
| `c` | Create new task file in current scope's repo |
| `r` | Run selected task now |
| `e` | Toggle enable/disable |
| `l` | Open latest run log for selected task |
| `x` | Open Runs for selected task |
| `d` | Delete selected task (with confirmation) |
| `Ctrl+S` | Sync selected task (if pending) |
| `S` | Sync all pending tasks |
| `n` | Open Notifications |
| `s` | Open Settings |
| `q` / `Ctrl+C` | Quit |

**Status badges:**

| Badge | Meaning |
|-------|---------|
| `running` | Task is currently executing |
| `loaded` | Registered with launchd, not currently running |
| `disabled` | `_enabled: false` in `.md` — not registered with launchd |
| `not loaded` | Plist is missing or was never bootstrapped — re-enable to restore |

**Sync badges:**

| Badge | Meaning |
|-------|---------|
| `● pending create` | `.md` file exists but no plist — press `Ctrl+S` to register |
| `● pending update` | A plist-encoded field changed in the `.md` — press `Ctrl+S` to apply |
| `○ orphaned` | Plist exists but its source `.md` was deleted or moved — press `Ctrl+S` to remove |

## Task Detail

Full view of a single task's config and live status. Shows all frontmatter fields, live launchd state, and the last run result.

| Key | Action |
|-----|--------|
| `r` | Run task now |
| `e` | Toggle enable/disable |
| `Ctrl+E` | Open `.md` file in `$EDITOR` |
| `Ctrl+S` | Sync task (if pending) |
| `x` | Open Runs |
| `d` | Delete task |
| `Esc` / `q` | Back |

## Runs

Two-level screen for browsing a task's execution history and logs. Press `x` to open it from the task list or task detail.

### Runs list

Shows all runs newest-first. Each row displays start time, exit code badge, duration, and attempt count.

| Key | Action |
|-----|--------|
| `↑` / `↓` / `j` / `k` | Navigate runs |
| `Enter` / `→` | Open run detail |
| `+` / `-` | Show more / fewer runs |
| `r` | Refresh |
| `Esc` / `q` | Back to task |

### Run detail

Shows metadata for the selected run (time, exit code, duration, attempts) and its log output — scoped to that run only. Tide log lines are dimmed; markdown in Claude output is rendered.

| Key | Action |
|-----|--------|
| `Tab` | Switch between OUTPUT and STDERR tabs |
| `f` | Start a follow-up run (completed runs only) |
| `o` | Open log file in `$EDITOR` (read-only) |
| `+` / `-` | Show more / fewer log lines |
| `r` | Refresh |
| `←` / `Esc` / `q` | Back to runs list |

Auto-refresh is enabled automatically when viewing the latest run of a currently-running task.

## Notifications

Review pending task-completion notifications. Each entry shows task name, run time, exit code, and output summary.

| Key | Action |
|-----|--------|
| `c` | Clear all pending notifications |
| `Esc` | Back |

Pressing `Esc` does **not** clear notifications — you must press `c` explicitly.

## Settings

Configure the global run command, default working directory, and date format. Changes are written to `~/.tide/settings.json` immediately on save.

Press `Esc` to go back without saving.
