# Settings

Press `s` from the task list to open the Settings screen.

## Date format

Controls how timestamps are displayed throughout the TUI:

| Format | Example |
|--------|---------|
| `MM/DD/YYYY` | `03/30/2026` |
| `DD/MM/YYYY` | `30/03/2026` |
| `YYYY-MM-DD` | `2026-03-30` |

## Settings file

Settings are stored in `~/.tide/settings.json`. You can edit this file directly — changes take effect on the next poll cycle.

::: warning Atomic writes
Tide writes settings atomically (temp-then-rename). Avoid holding the file open while Tide is running.
:::

## Agent auth profiles {#agent-auth-profiles}

Auth configuration lives in `settings.json` under `agentAuths` — a map of profile names to their config. Task frontmatter references a profile by name:

```json
{
  "agentAuths": {
    "tsh-okta-bedrock": {
      "strategy": "tsh-okta-bedrock",
      "app": "n26-dev-eu",
      "awsRole": "bedrock-developer-user",
      "teleportProxy": "teleport.access26.de:443",
      "model": "arn:aws:bedrock:eu-central-1:..."
    }
  }
}
```

```yaml
# in task frontmatter
agentAuth: tsh-okta-bedrock
```

You can define multiple profiles (e.g. for different AWS roles or Bedrock regions) and reference whichever is appropriate per task.

### Auth profile fields

| Field | Description |
|-------|-------------|
| `strategy` | Auth strategy. Currently only `tsh-okta-bedrock`. |
| `app` | Teleport application name passed to `tsh aws --app`. |
| `awsRole` | AWS role passed to `tsh aws --aws-role`. |
| `teleportProxy` | Teleport proxy address passed to `tsh aws --proxy`. |
| `model` | Bedrock inference profile ARN used as the Claude model. |

## Terminal app

The terminal app to open when you click a task completion notification. Requires [`terminal-notifier`](https://github.com/julienXX/terminal-notifier) (`brew install terminal-notifier`) — without it, notifications are sent via `osascript` and clicking opens Script Editor instead.

Options: Terminal, iTerm2, Warp, Ghostty, Alacritty, Kitty.
