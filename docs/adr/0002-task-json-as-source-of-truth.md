# ADR-0002: task.json as source of truth, plist as derived artifact
Date: 2026-03-30
Status: Superseded by [ADR-0005](0005-markdown-task-files.md)

## Context

Each task has two on-disk representations:

- `~/.tide/tasks/<id>/task.json` — application config (name, schedule, command, retries, retention, etc.)
- `~/Library/LaunchAgents/com.tide.<id>.plist` — launchd job definition

The question arose whether the plist could become the single source of truth, eliminating the need to keep two files in sync.

The launchd plist format is a typed Apple XML schema designed for OS-level job configuration. It has no native fields for application metadata like `name`, `maxRetries`, `resultRetentionDays`, or `createdAt`. Storing these would require encoding them as `EnvironmentVariables` entries or XML comments — both are hacks that invert the intended use of the format.

Additionally, a disabled task has no plist registered with launchd at all — disabling a task means booting it out and removing the plist from launchd's view. The `enabled` field therefore cannot be represented in a plist that only exists when the task is active.

Reading the plist at runtime would also require either XML parsing in the shell (painful) or `plutil -convert json` calls — replacing a `JSON.parse` with a subprocess invocation.

## Decision

`task.json` is the authoritative config for a task. The launchd plist is a derived artifact — a projection of `task.json` into the format launchd requires. The plist can always be regenerated from `task.json`.

Fields in `task.json` not present in the plist (`name`, `enabled`, `maxRetries`, `resultRetentionDays`, `createdAt`, `argument`, `extraArgs`, `jitterSeconds`) remain in `task.json` only.

## Consequences

- Two files must be kept in sync on create and update. `create.js` owns this: it writes `task.json` first, then generates and bootstraps the plist.
- If the plist is deleted or becomes stale, the task shows as `not loaded` in the UI but is not lost — the user can re-enable it to regenerate the plist from `task.json`.
- The design is portable: `task.json` has no macOS-specific structure, so the scheduling backend could be swapped (e.g. systemd on Linux) without changing the config format.
