# Tide

Tide is a macOS task scheduler with a terminal UI. Define a command and a schedule, and Tide runs it in the background using launchd.

**[Full documentation →](https://brunomachadob.github.io/tide/)**

## Quick start

```sh
npx github:Brunomachadob/tide
```

Requires macOS and Node.js 18+.

On first launch, configure your **run command** in Settings (e.g. `/opt/homebrew/bin/claude --permission-mode bypassPermissions -p`), then press `n` to create a task.

## Why this exists

Claude Code's built-in scheduler (`CronCreate`/`CronDelete`) only fires during an active session. Tide delegates to **macOS launchd** so tasks run on schedule regardless of whether any app is open.

## TODO / Future Improvements

- [ ] **Chain tasks** — `onSuccess: <task-id>` to trigger another task on success
- [ ] **Export/import** — dump all tasks as JSON for backup or migration
