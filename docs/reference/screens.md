# Screens

## Task List (default)

The main screen. Shows all tasks with status, schedule, and last result.

**Keyboard shortcuts:**

| Key | Action |
|-----|--------|
| `↑` / `↓` | Navigate tasks |
| `Enter` | Open Task Detail |
| `n` | Create new task |
| `e` | Edit selected task |
| `d` | Delete selected task (with confirmation) |
| `t` | Toggle enable/disable |
| `l` | Open Logs for selected task |
| `r` | Open Results for selected task |
| `N` | Open Notifications |
| `s` | Open Settings |
| `q` / `Ctrl+C` | Quit |

**Status badges:**

| Badge | Meaning |
|-------|---------|
| `running` | Task is currently executing (launchd shows an active PID) |
| `loaded` | Registered with launchd, not currently running |
| `disabled` | `enabled: false` in task.json — not registered with launchd |
| `not loaded` | Plist is missing or was never bootstrapped — can be re-enabled |

## Task Detail

Full view of a single task's config and live status.

Shows config from `task.json`, live launchd state (PID if running, last exit code from launchd's perspective), and the last result from the results directory.

Press `e` to edit, `l` for logs, `r` for results, `Esc` to go back.

## Create / Edit Task

Form for creating or editing a task. Fields: name, argument, interval (seconds), working directory, max retries.

`Enter` on the last field (or a dedicated save button) writes the task and returns to the task list.

`Esc` cancels without saving.

## Logs

Displays log file contents for a task. Two tabs: `output.log` (combined stdout + stderr) and `stderr.log`.

| Key | Action |
|-----|--------|
| `Tab` | Switch between output.log and stderr.log |
| `↑` / `↓` | Scroll |
| `Esc` | Back |

Content is polled on an interval — the view updates live while a task is running.

## Results

Browse structured result JSON files for a task, newest-first. Each entry shows exit code, start/finish timestamps, and attempt count.

| Key | Action |
|-----|--------|
| `↑` / `↓` | Navigate results |
| `Esc` | Back |

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
