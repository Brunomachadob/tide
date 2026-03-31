# Screens

## Task List (default)

The main screen. Shows all tasks with status, schedule, and last result.

**Keyboard shortcuts:**

| Key | Action |
|-----|--------|
| `↑` / `↓` | Navigate tasks |
| `Enter` | Open Task Detail |
| `c` | Create new task |
| `r` | Run selected task now |
| `e` | Toggle enable/disable |
| `x` | Open Runs for selected task |
| `d` | Delete selected task (with confirmation) |
| `n` | Open Notifications |
| `s` | Open Settings |
| `R` | Refresh |
| `q` / `Ctrl+C` | Quit |

**Status badges:**

| Badge | Meaning |
|-------|---------|
| `running` | Task is currently executing |
| `loaded` | Registered with launchd, not currently running |
| `disabled` | `enabled: false` in task.json — not registered with launchd |
| `not loaded` | Plist is missing or was never bootstrapped — can be re-enabled |

## Task Detail

Full view of a single task's config and live status.

Shows config from `task.json`, live launchd state, and the last run result.

| Key | Action |
|-----|--------|
| `r` | Run task now |
| `k` | Kill running task (only shown when running) |
| `e` | Toggle enable/disable |
| `E` | Edit task |
| `x` | Open Runs |
| `d` | Delete task |
| `R` | Refresh |
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

Shows metadata for the selected run (time, exit code, duration, attempts) and its log output — scoped to that run only.

| Key | Action |
|-----|--------|
| `Tab` | Switch between OUTPUT and STDERR |
| `f` | Toggle auto-refresh (live follow) |
| `+` / `-` | Show more / fewer log lines |
| `r` | Refresh |
| `←` / `Esc` / `q` | Back to runs list |

Auto-refresh is enabled automatically when viewing the latest run of a currently-running task.

## Create / Edit Task

Form for creating or editing a task. Fields: name, argument, interval (seconds), working directory, max retries.

`Esc` cancels without saving.

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
