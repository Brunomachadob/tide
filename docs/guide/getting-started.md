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

On first launch you land on the task list — empty for now.

::: tip Configure a profile before creating tasks
Add a profile to `~/.tide/settings.json` under `profiles` before creating tasks. The new-task template will pick it up automatically. See [Settings](/guide/settings#profiles).
:::

:::tabs key:agent
== Claude Code
```json
{
  "profiles": {
    "my-claude": {
      "agent": "claude-code"
    }
  }
}
```
== Copilot
```json
{
  "profiles": {
    "my-copilot": {
      "agent": "copilot"
    }
  }
}
```
== Gemini
```json
{
  "profiles": {
    "my-gemini": {
      "agent": "gemini",
      "model": "gemini-2.5-pro"
    }
  }
}
```
:::

## Create your first task

Press `c` on the task list to open a new task `.md` file in `$EDITOR`. The template is pre-filled with your first profile from settings.

Edit the file:
- Set `name` and `schedule`
- Update `workingDirectory` if needed
- Write your prompt as the file body (below the `---`)

Save and close the editor. Tide detects the new file and shows it as **pending create**. Press `[s]` to register it with launchd.

::: info What happens on sync
1. Tide writes `_id`, `_createdAt`, `_jitter`, `_enabled` back to the `.md` file
2. `~/Library/LaunchAgents/com.tide.<id>.plist` is generated pointing to `tide.sh`
3. `launchctl bootstrap` registers the plist — the task is now live
:::

## Verify it's running

Back on the task list, your task shows with status `loaded`. The next scheduled run is approximately `interval + jitter` seconds from now.

Press `Enter` on a task to open the **Task Detail** screen, which shows:

- Full config from the task's `.md` file
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
