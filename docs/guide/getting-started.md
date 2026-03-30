# Getting Started

## Prerequisites

- macOS (Tide uses launchd and macOS-only APIs)
- Node.js 18 or later

## Installation

Tide runs directly from GitHub — no install step needed:

```sh
npx github:Brunomachadob/tide
```

This fetches the latest version and launches the TUI.

## First launch

On first launch, Tide detects that no **run command** is configured and drops you into the Settings screen.

The run command is the full command Tide will invoke for each task, with the task's argument appended as the final argument. For running Claude prompts:

```
/opt/homebrew/bin/claude --permission-mode bypassPermissions -p
```

::: tip Finding your Claude path
Run `which claude` in your terminal to get the full path.
:::

Once saved, you land on the task list — empty for now.

## Create your first task

Press `n` on the task list to open the **Create Task** screen.

Fill in:

| Field | Description |
|-------|-------------|
| **Name** | A human-readable label shown in the TUI |
| **Argument** | The argument appended to the run command when the task fires |
| **Interval** | How often to run, in seconds |
| **Working directory** | Directory the command runs in (defaults to your home directory) |

Press `Enter` to save. Tide writes a `task.json`, generates a launchd plist, and registers it with launchd immediately.

::: info What happens on save
1. `~/.tide/tasks/<id>/task.json` is written with your config
2. `~/Library/LaunchAgents/com.tide.<id>.plist` is generated from `task.json`
3. `launchctl bootstrap` registers the plist — the task is now live
:::

## Verify it's running

Back on the task list, your task shows with status `loaded`. The next scheduled run is approximately `interval + jitter` seconds from now.

Press `Enter` on a task to open the **Task Detail** screen, which shows:

- Full config from `task.json`
- Live launchd status (loaded, PID if running, last exit code)
- Time of last run

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| `n` | New task |
| `Enter` | Open task detail |
| `l` | View logs for selected task |
| `r` | View results for selected task |
| `e` | Edit selected task |
| `d` | Delete selected task (with confirmation) |
| `t` | Toggle enable/disable |
| `N` | View notifications |
| `s` | Settings |
| `q` / `Ctrl+C` | Quit |
