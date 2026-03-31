# Creating Tasks

## The task form

Press `n` on the task list to open the Create Task screen. Press `e` on a selected task to edit it.

All fields:

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `name` | Yes | — | Human-readable label |
| `argument` | Yes | — | Final argument passed to the run command |
| `schedule` | Yes | — | `Manual only` or an interval (15m – 24h) |
| `workingDirectory` | No | `~` | Directory the command runs in |
| `maxRetries` | No | `0` | Extra attempts on failure (0 = no retries) |

## What Tide does on save

1. Generates a random 8-character hex ID (e.g. `3f640f65`)
2. For interval tasks: assigns a random `jitterSeconds` value between 0 and `min(interval/4, 300)`. Manual tasks get `jitterSeconds: 0`.
3. Writes `~/.tide/tasks/<id>/task.json`
4. Generates `~/Library/LaunchAgents/com.tide.<id>.plist` from the task config. Manual tasks produce a plist with no `StartInterval` key.
5. Validates the plist with `plutil -lint` (hard error if invalid)
6. Calls `launchctl bootstrap` to register the task — interval tasks are live immediately; manual tasks are registered but will not fire until triggered

## How the run command is assembled

When a task fires, Tide invokes:

```
<command from settings> [extraArgs...] <task argument>
```

For example, with settings command `/opt/homebrew/bin/claude --permission-mode bypassPermissions -p` and task argument `Summarize open PRs in /my/repo`:

```sh
/opt/homebrew/bin/claude --permission-mode bypassPermissions -p "Summarize open PRs in /my/repo"
```

The argument is passed as a single quoted shell word.

::: tip Per-task command override
A task can override the global run command by setting `command` directly in `task.json`. The TUI does not expose this field — edit `task.json` directly to use it.
:::

## Editing a task

Press `e` on any task. The same form pre-fills with existing values.

On save, Tide:
1. Merges your changes into the existing `task.json`
2. Regenerates the plist
3. If the task is enabled: boots out the old registration and bootstraps the new one

::: warning Editing a running task
If the task is currently running when you edit it, the running instance is not interrupted. The new config takes effect on the next scheduled run.
:::

## Enabling and disabling

Press `t` on the task list to toggle a task on/off.

- **Disable:** `launchctl bootout` is called, the plist is removed from launchd's view. The task will not fire.
- **Enable:** The plist is regenerated from `task.json` and `launchctl bootstrap` registers it again.

The `task.json` is never deleted on disable — it's the source of truth and can always regenerate the plist.

## Deleting a task

Press `d` and confirm. Tide:
1. Boots out the launchd registration (if loaded)
2. Removes the plist from `~/Library/LaunchAgents/`
3. Deletes `~/.tide/tasks/<id>/` and all its contents (logs, results)

::: danger Deletion is permanent
There is no undo. Logs and results are deleted along with the task config.
:::

## Example: daily Claude prompt

Goal: run a Claude prompt every 24 hours that summarizes your git activity.

**Settings command:**
```
/opt/homebrew/bin/claude --permission-mode bypassPermissions -p
```

**Create task:**
- Name: `Daily git summary`
- Argument: `Summarize git log --since=24h.ago --all in /Users/you/projects/myrepo. List commits by author, highlight any TODOs added.`
- Interval: `86400` (24 hours in seconds)
- Working directory: `/Users/you/projects/myrepo`

After saving, Tide fires the task in approximately 24 hours (plus jitter). Results and logs are available from the task list.
