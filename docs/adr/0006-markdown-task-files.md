# ADR-0006: Markdown task files as source of truth
Date: 2026-04-01
Status: Accepted — supersedes [ADR-0002](0002-task-json-as-source-of-truth.md)

## Context

ADR-0002 established `task.json` as the authoritative config for a task and the launchd plist as a derived artifact. This worked well for a single-machine local scheduler, but it meant the task's prompt (the `argument` field — the most important part) lived in `~/.tide/` and could not be versioned, reviewed in pull requests, or shared across machines via git.

The primary use case for Tide is scheduling AI tasks (Claude prompts). These prompts benefit from version control: you want to see what changed, diff revisions, and track the evolution of an instruction over time alongside the code it operates on.

## Decision

Task configuration is now authored as a markdown file inside the repository where the task is relevant:

```
<repo>/.tide/<taskname>.md
```

The file body is the task's prompt (argument). All scheduling metadata lives in YAML frontmatter. Example:

```markdown
---
name: Daily standup summary
schedule: 1h
---

Summarize the git log from the last 24 hours.
```

`task.json` is now a *derived artifact* of the markdown file — the same relationship that previously existed between `task.json` and the launchd plist. When Tide detects a change in the markdown file, it shows it as a pending sync operation in the UI. The user reviews and applies changes explicitly.

The `id` field is the only field Tide writes back into the frontmatter — generated once on first sync and stable forever after.

## Consequences

- Task prompts can be committed to git, reviewed in PRs, and diffed over time.
- Tasks from any repo where Tide has been launched are visible in the TUI (cross-repo via `task.json` `sourcePath` field).
- Shell scripts (`tide.sh`, `task-setup.js`, `task-postprocess.js`) are unchanged — they still read `task.json`.
- Deleting a markdown file marks the task as `orphaned` in the UI; the user confirms removal.
- The 7-step CreateTaskScreen wizard is removed. Creating a task means creating a `.md` file (`[c]` opens `$EDITOR`).
- A future Phase 2 plan (`plans/phase2-plist-as-source.md`) documents how to remove `task.json` entirely and drive launchd directly from the markdown file.
