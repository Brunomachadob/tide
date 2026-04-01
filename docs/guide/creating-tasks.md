# Creating Tasks

## Create a task file

Press `c` on the task list to open a new `.md` file in `$EDITOR`. The file is created at `<repo>/.tide/<name>.md`.

A minimal task file looks like this:

```markdown
---
name: Daily standup summary
schedule: 1h
---

Summarize the git log from the last 24 hours in this repo.
```

Save and close the editor. Tide detects the new file and shows it as **pending create** in the task list. Press `[s]` to register it with launchd.

## What Tide does on sync (`[s]`)

1. Reads the `.md` frontmatter + body
2. Generates a random 8-character hex `_id` (e.g. `3f640f65`) and writes it back to the frontmatter
3. For interval tasks: assigns a random `_jitter` between 0 and `min(interval/4, 300)` seconds. Manual tasks get `_jitter: 0`.
4. Writes `_createdAt` and `_enabled: true` back to the frontmatter
5. Generates `~/Library/LaunchAgents/com.tide.<id>.plist` from the frontmatter
6. Validates the plist with `plutil -lint` (hard error if invalid)
7. Calls `launchctl bootstrap` to register the task

After first sync the file gains underscore-prefixed internal fields:

```markdown
---
_id: 3f640f65
_createdAt: 2026-04-01T10:00:00Z
_jitter: 42
_enabled: true
name: Daily standup summary
schedule: 1h
---

Summarize the git log from the last 24 hours in this repo.
```

## When changes need a sync vs take effect automatically

Changes to `schedule`, `workingDirectory`, `env`, or `timeoutSeconds` require a sync — these are encoded in the plist. All other changes (prompt body, `name`, `command`, `maxRetries`, `claudeStreamJson`, etc.) take effect at the next scheduled run automatically because `tide.sh` reads the `.md` file directly at runtime.

## How the run command is assembled

When a task fires, Tide invokes:

```
<command> [extraArgs...] <prompt body>
```

For example, with settings command `/opt/homebrew/bin/claude --permission-mode bypassPermissions -p` and the prompt body `Summarize open PRs in /my/repo`:

```sh
/opt/homebrew/bin/claude --permission-mode bypassPermissions -p "Summarize open PRs in /my/repo"
```

The body is passed as a single quoted shell word.

::: tip Per-task command override
Set `command` in the frontmatter to override the global run command for a specific task.
:::

## Editing a task

Press `e` on any task to open its `.md` file in `$EDITOR`.

- Changes to the prompt body or non-plist fields: take effect at the next scheduled run — no action needed.
- Changes to `schedule`, `workingDirectory`, `env`, or `timeoutSeconds`: a sync badge appears. Press `[s]` to apply.

::: warning Editing a running task
If the task is currently running when you edit it, the running instance is not interrupted. The new config takes effect on the next run.
:::

## Enabling and disabling

Press `t` on the task list to toggle a task on/off. This writes `_enabled` back to the `.md` file.

- **Disable:** `launchctl bootout` removes the task from launchd. The task will not fire.
- **Enable:** The plist is regenerated and `launchctl bootstrap` re-registers it.

## Deleting a task

Press `d` and confirm. Tide:
1. Boots out the launchd registration (if loaded)
2. Removes the plist from `~/Library/LaunchAgents/`
3. Deletes `~/.tide/tasks/<id>/` and all its contents (run history, logs)
4. Does **not** delete the `.md` file — that is yours to remove from the repo

::: danger Deletion removes run history
Logs and run history in `~/.tide/tasks/<id>/` are deleted. The `.md` file remains in your repo.
:::

## Example: daily Claude prompt

**Settings command:**
```
/opt/homebrew/bin/claude --permission-mode bypassPermissions -p
```

**Create `.tide/daily-summary.md`:**
```markdown
---
name: Daily git summary
schedule: 24h
workingDirectory: ~/projects/myrepo
---

Summarize git log --since=24h.ago --all. List commits by author, highlight any TODOs added.
```

After pressing `[s]`, Tide registers the task with launchd. It will fire approximately every 24 hours (plus jitter). Results are visible from the task list.
