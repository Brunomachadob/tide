# Creating Tasks

## Task file location

Task files live at `<repo>/.tide/<taskname>.md`. Tide discovers which repo to use based on where it is launched:

- If the current directory (or any parent, up to a `.git` boundary) contains a `.tide/` folder, that is the active repo.
- A bare `.tide/` directory with no `.git` ancestor is also valid (e.g. `~/tasks/.tide/`).
- Tasks from **all** repos are always visible globally via their plists — the repo only affects which tasks are shown in scoped view and where `[c]` creates new files.

## Create a task file

Press `c` on the task list to open a new `.md` file in `$EDITOR`. After you save and close, the file is named from the `name` field you set (e.g. `name: Daily standup` → `daily-standup.md`) and placed in `<repo>/.tide/`.

A minimal task file looks like this:

```markdown
---
name: Daily standup summary
schedule: 1h
profile: my-claude
---

Summarize the git log from the last 24 hours in this repo.
```

`profile` is the name of a profile defined in `~/.tide/settings.json`. See [Settings](/guide/settings#profiles).

Save and close the editor. Tide detects the new file and shows it as **pending create** in the task list. Press `[s]` to register it with launchd.

## What Tide does on sync (`[s]`)

1. Reads the `.md` frontmatter + body
2. Generates a random 8-character hex `_id` (e.g. `3f640f65`) and writes it back to the frontmatter
3. Generates `~/Library/LaunchAgents/com.tide.<id>.plist` from the frontmatter, storing jitter and creation time as plist env vars
4. Validates the plist with `plutil -lint` (hard error if invalid)
5. Calls `launchctl bootstrap` to register the task

After first sync the file gains one internal field:

```markdown
---
_id: 3f640f65
name: Daily standup summary
schedule: 1h
---

Summarize the git log from the last 24 hours in this repo.
```

## When changes need a sync vs take effect automatically

Changes to `schedule`, `workingDirectory`, `env`, or `timeoutSeconds` require a sync — these are encoded in the plist. All other changes (prompt body, `name`, `profile`, etc.) take effect at the next scheduled run automatically because `tide.sh` reads the `.md` file directly at runtime.

## How a task runs

When a task fires, `tide.sh` resolves the `profile` key against `~/.tide/settings.json` and hands off to `agent-runner.js`:

```
tide.sh → agent-runner.js → agent plugin (claude-code / copilot / gemini)
```

For `claude-code` profiles with `tsh` auth (AWS Bedrock via Teleport):
```
tide.sh → tsh aws --exec → agent-runner.js → Claude Agent SDK → claude binary
```

The prompt body (below the `---`) is passed as the prompt to the agent. Output streams to `output.log` in real time.

## Editing a task

Press `e` on any task to open its `.md` file in `$EDITOR`.

- Changes to the prompt body or non-plist fields: take effect at the next scheduled run — no action needed.
- Changes to `schedule`, `workingDirectory`, `env`, or `timeoutSeconds`: a sync badge appears. Press `[s]` to apply.

::: warning Editing a running task
If the task is currently running when you edit it, the running instance is not interrupted. The new config takes effect on the next run.
:::

## Enabling and disabling

Press `e` on the task list to toggle a task on/off. Enabled/disabled state is stored in the plist, not the `.md` file.

- **Disable:** rewrites the plist with `Disabled: true` and calls `launchctl bootout`. The task will not fire.
- **Enable:** rewrites the plist without `Disabled` and calls `launchctl bootstrap`.

## Moving tasks between repos

To move a task to a different repo:

1. Move the `.md` file to the target repo's `.tide/` directory.
2. In Tide, the task will appear as **orphaned** (stale plist pointing to the old path). Sync it away with `Ctrl+S`.
3. Open Tide from the target repo (or ensure the target `.tide/` is discovered). The moved `.md` appears as **pending create**. Sync it to register with launchd.

The task's run history is preserved — it lives in `~/.tide/tasks/<id>/` and is keyed by `_id`, not by file path.

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

**Create `.tide/daily-summary.md`:**
```markdown
---
name: Daily git summary
schedule: 24h
workingDirectory: ~/projects/myrepo
profile: my-claude
---

Summarize git log --since=24h.ago --all. List commits by author, highlight any TODOs added.
```

After pressing `[s]`, Tide registers the task with launchd. It will fire approximately every 24 hours (plus jitter). Results are visible from the task list.

::: tip Profiles
Define profiles once in `~/.tide/settings.json` under `profiles` and reference them by name. See [Settings](/guide/settings#profiles).
:::
