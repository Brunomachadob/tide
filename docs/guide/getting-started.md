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

If `~/.tide/settings.json` doesn't exist yet, Tide opens an **onboarding screen** instead of the task list.

Select the agents you want to use with `↑`/`↓` and `Space`, then press `c` to confirm. Tide writes a minimal profile for each selected agent to `~/.tide/settings.json` and drops you into the task list.

| Agent | Pre-auth required |
|-------|------------------|
| Claude Code | `claude /login` or `ANTHROPIC_API_KEY` |
| GitHub Copilot | `gh auth login` |
| Gemini CLI | `npx @google/gemini-cli` |

You can skip onboarding with `Esc`/`q` and configure profiles manually later — see [Settings](/guide/settings#profiles).

::: tip Profiles use the agent name as key
The generated profiles are named after the agent (`claude-code`, `copilot`, `gemini`). Reference them in task frontmatter with `profile: claude-code` etc.
:::

## Create your first task

Press `c` on the task list to open a new task `.md` file in `$EDITOR`. The template is pre-filled with your first profile from settings.

Edit the file:
- Set `name` and `schedule`
- Update `workingDirectory` if needed
- Write your prompt as the file body (below the `---`)

Save and close the editor. Tide detects the new file and shows it as **pending create**. Press `[s]` to register it with launchd.

::: info What happens on sync
1. Tide writes `_id`, `_createdAt`, and `_jitter` back to the `.md` file
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
| `c` | Create new task |
| `Enter` | Open task detail |
| `l` | Open latest run |
| `x` | Open runs list |
| `e` | Toggle enable/disable |
| `r` | Run task now |
| `d` | Delete selected task (with confirmation) |
| `n` | View notifications |
| `s` | Settings |
| `q` / `Ctrl+C` | Quit |
