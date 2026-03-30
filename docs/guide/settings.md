# Settings

Press `s` from the task list to open the Settings screen.

## Run command

The **run command** is the full command Tide invokes for every task, with the task's `argument` appended as the final argument.

Example for running Claude prompts:

```
/opt/homebrew/bin/claude --permission-mode bypassPermissions -p
```

When a task with argument `"Summarize my git log"` runs, Tide executes:

```sh
/opt/homebrew/bin/claude --permission-mode bypassPermissions -p "Summarize my git log"
```

::: tip Use the full path
launchd jobs run in a minimal environment and may not have your shell's `$PATH`. Use the full absolute path to your command binary.

To find the full path: `which claude` → `/opt/homebrew/bin/claude`
:::

::: warning Required on first launch
Tide will not show the task list until a run command is configured. On first launch you are taken directly to the Settings screen.
:::

## Default working directory

The working directory the command runs in, if no per-task working directory is set. Defaults to your home directory (`~`).

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
  "command": "/opt/homebrew/bin/claude --permission-mode bypassPermissions -p",
  "workingDirectory": "/Users/you",
  "dateFormat": "YYYY-MM-DD"
}
```

You can edit this file directly. Changes take effect the next time Tide reads it (on the next poll cycle, approximately 1 second).

::: warning Atomic writes
Tide writes settings atomically (temp-then-rename). If you edit `settings.json` while Tide is running, your changes will be preserved unless Tide writes settings at the same moment. Avoid holding the file open.
:::

## Per-task command override

A task can override the global run command by setting `command` in its `task.json`:

```json
{
  "id": "3f640f65",
  "command": "/usr/bin/python3 /path/to/my-script.py",
  ...
}
```

The TUI does not expose this field. Edit `task.json` directly in `~/.tide/tasks/<id>/task.json` to use it. The change takes effect on the next run.
