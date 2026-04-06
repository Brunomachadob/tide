# Tide

Tide is a macOS task scheduler with a terminal UI. Define a command and a schedule, and Tide runs it in the background using launchd.

**[Full documentation →](https://brunomachadob.github.io/tide/)**

## Quick start

```sh
npx github:Brunomachadob/tide
```

Requires macOS and Node.js 18+.

On first launch, an onboarding screen lets you pick which agents to set up (Claude Code, Copilot, Gemini). Select one or more, press `c` to confirm, then press `n` to create your first task.

## Features

- **Scheduled tasks** — define a command and a cron-style schedule; launchd runs it even when no app is open
- **Follow-up runs** — from any run's detail view, press `f` to chain a new run pre-seeded with the previous run's argument and output ([docs](https://brunomachadob.github.io/tide/guide/logs-and-results#follow-up-runs))
- **Run history** — browse logs, exit codes, and retry counts per run

## Why this exists

Claude Code's built-in scheduler (`CronCreate`/`CronDelete`) only fires during an active session. Tide delegates to **macOS launchd** so tasks run on schedule regardless of whether any app is open.

## TODO / Future Improvements

- [ ] **Chain tasks** — `onSuccess: <task-id>` to trigger another task on success
- [ ] **Export/import** — dump all tasks as JSON for backup or migration
