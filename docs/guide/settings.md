# Settings

Press `s` from the task list to open the Settings screen.

## Default working directory

The working directory tasks run in when no per-task `workingDirectory` is set. Defaults to your home directory (`~`).

## Date format

Controls how timestamps are displayed throughout the TUI:

| Format | Example |
|--------|---------|
| `MM/DD/YYYY` | `03/30/2026` |
| `DD/MM/YYYY` | `30/03/2026` |
| `YYYY-MM-DD` | `2026-03-30` |

## Settings file

Settings are stored in `~/.tide/settings.json`:

```json
{
  "defaultWorkingDirectory": "/Users/you",
  "dateFormat": "YYYY-MM-DD",
  "agentAuth": {
    "strategy": "tsh-okta-bedrock",
    "app": "n26-dev-eu",
    "awsRole": "bedrock-developer-user",
    "teleportProxy": "teleport.access26.de:443",
    "model": "arn:aws:bedrock:eu-central-1:538639307912:application-inference-profile/xswegkx4emk1"
  }
}
```

You can edit this file directly. Changes take effect the next time Tide reads it (on the next poll cycle).

::: warning Atomic writes
Tide writes settings atomically (temp-then-rename). If you edit `settings.json` while Tide is running, your changes will be preserved unless Tide writes settings at the same moment. Avoid holding the file open.
:::

## Default agentAuth

Add an `agentAuth` block to `settings.json` to avoid repeating auth configuration in every task file. Any task that does not include its own `agentAuth` frontmatter block will use this default.

Task-level `agentAuth` overrides the settings default entirely (no field-level merge).

## Terminal app

The terminal app to open when you click a task completion notification. Requires [`terminal-notifier`](https://github.com/julienXX/terminal-notifier) (`brew install terminal-notifier`) — without it, notifications are sent via `osascript` and clicking opens Script Editor instead.

Options: Terminal, iTerm2, Warp, Ghostty, Alacritty, Kitty.
