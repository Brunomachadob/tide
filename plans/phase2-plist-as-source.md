# Phase 2: Plist as derived artifact, task.json removed

## Status: Completed — implemented 2026-04-01

This plan has been implemented. See [ADR-0006](../docs/adr/0006-markdown-task-files.md) for the final architecture.

## Summary of what was built

- `task.json` is no longer written or read
- The launchd plist is the only derived artifact, generated directly from `.md` frontmatter
- The plist includes `TIDE_TASK_FILE` env var pointing back to the source `.md`
- `tide.sh`, `task-setup.js`, and `task-postprocess.js` read the `.md` directly at runtime
- `readTasks()` scans `~/Library/LaunchAgents/com.tide.*.plist` files globally
- Internal fields (`id`, `createdAt`, `jitter`, `enabled`) are stored as underscore-prefixed frontmatter keys (`_id`, `_createdAt`, `_jitter`, `_enabled`)
- Only plist-encoded fields (`schedule`, `workingDirectory`, `env`, `timeoutSeconds`, `enabled`) require a sync step; all other changes take effect at the next run automatically
- One-off migration: `scripts/migrate-to-phase2.js`
