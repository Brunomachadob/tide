# ADR-0004: Markdown task files as source of truth
Date: 2026-04-01
Status: Accepted — supersedes [ADR-0002](0002-task-json-as-source-of-truth.md)

## Context

ADR-0002 established `task.json` as the authoritative config for a task and the launchd plist as a derived artifact. This worked well for a single-machine local scheduler, but it meant the task's prompt (the `argument` field — the most important part) lived in `~/.tide/` and could not be versioned, reviewed in pull requests, or shared across machines via git.

The primary use case for Tide is scheduling AI tasks (Claude prompts). These prompts benefit from version control: you want to see what changed, diff revisions, and track the evolution of an instruction over time alongside the code it operates on.

## Decision

Task configuration is authored as a markdown file inside the repository where the task is relevant:

```
<repo>/.tide/<taskname>.md
```

The file body is the task's prompt (argument). All scheduling metadata lives in YAML frontmatter. The launchd plist is the only derived artifact — generated directly from the markdown file.

**User-authored frontmatter** (written by hand):
```markdown
---
name: Daily standup summary
schedule: 1h
workingDirectory: ~/projects/myrepo
---

Summarize the git log from the last 24 hours.
```

**Internal frontmatter** (underscore-prefixed, written by Tide — do not edit):
```markdown
---
_id: 3f640f65
name: Daily standup summary
schedule: 1h
---
```

The `_` prefix reserves internal fields that Tide manages. These are valid YAML keys and survive round-trips through any YAML-aware editor, but should not be changed manually.

### How sync works

The plist contains a `TIDE_TASK_FILE` environment variable pointing back to the source `.md` file. At runtime, `tide.sh` reads `TIDE_TASK_FILE` and passes the `.md` path to `agent-runner.js`, which parses it directly.

Only fields that the plist actually encodes need a sync step to take effect: `schedule`, `workingDirectory`, `env`, `timeoutSeconds`. All other field changes (name, argument, command, maxRetries, etc.) take effect at the next run automatically — no sync required.

The TUI shows a pending-update badge when a plist-encoded field changes in the `.md` file. Pressing `[s]` applies the change (rewrites the plist and re-registers with launchd).

### Cross-repo visibility and orphan detection

Because all registered tasks have plists in `~/Library/LaunchAgents/`, `readTasks()` scans `com.tide.*.plist` files globally. Orphan detection is trivially global: check `existsSync(TIDE_TASK_FILE)` for each plist.

Multi-repo scope, pending-create discovery across all `.tide/` roots, and the UI scope selector are covered in [ADR-0006](0006-multi-repo-scope.md).

## Consequences

- Task prompts can be committed to git, reviewed in PRs, and diffed over time.
- `task.json` is no longer written or read. The plist is the only derived artifact.
- Shell scripts (`tide.sh`, `task-setup.js`, `task-postprocess.js`) read the `.md` file directly at runtime via `TIDE_TASK_FILE`.
- Deleting a markdown file marks the task as `orphaned` in the UI; the user confirms removal.
- Creating a task means creating a `.md` file (`[c]` opens `$EDITOR`).
- Changes to prompt/command/name take effect at the next scheduled run without any sync step.
- `writeTideFields` / `writeTideFieldsInline` use regex-based in-place replacement rather than `matter.stringify` to avoid YAML key quoting issues (gray-matter quotes keys containing special characters, which would corrupt the `_key` format on round-trips).
