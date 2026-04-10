# Tide

Tide is a macOS scheduler for AI agents — run Claude Code, GitHub Copilot, and Gemini tasks on a recurring interval via launchd, with a terminal UI to manage them.

**[Full documentation →](https://brunomb.com/tide/)**

## Quick start

```sh
npx github:Brunomachadob/tide#v1.0.0  # x-release-please-version
```

Requires macOS and Node.js 18+.

On first launch, an onboarding screen lets you pick which agents to set up (Claude Code, Copilot, Gemini). Select one or more, press `c` to confirm, then press `n` to create your first task.

## Features

- **Scheduled tasks** — define a prompt and an interval schedule; launchd runs it even when no app is open
- **Follow-up runs** — from any run's detail view, press `f` to chain a new run pre-seeded with the previous run's argument and output ([docs](https://brunomb.com/tide/guide/logs-and-results#follow-up-runs))
- **Run history** — browse logs, exit codes, and retry counts per run

## Why this exists

AI coding assistants (Claude Code, Copilot, Gemini) don't have a persistent scheduler — any built-in scheduling only fires while the app is open. Tide delegates to **macOS launchd** so agent tasks run on schedule regardless of whether any app is open.

## TODO / Future Improvements

- [ ] **Chain tasks** — `onSuccess: <task-id>` to trigger another task on success
- [ ] **Export/import** — dump all tasks as JSON for backup or migration
