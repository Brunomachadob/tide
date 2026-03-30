# Tide — Claude Code Notes

## Testing

Uses Node's built-in test runner (`node:test`) — no extra dependencies.

```
npm test
```

### Test files

| File | What it covers |
|---|---|
| `test/format.test.js` | `formatDate`, `formatRelativeTime`, `formatSchedule` |
| `test/settings.test.js` | `readSettings`, `writeSettings` |
| `test/tasks.test.js` | `readTask`, `readTasks`, `writeTask`, `resolveTask`, `resolveId`, `setEnabled`, `deleteTask`, `taskDir`, `taskFile` |
| `test/results.test.js` | `getResults`, `getLatestResult` |
| `test/logs.test.js` | `getOutputLog`, `getStdoutLog`, `getStderrLog` |
| `test/notifications.test.js` | `getNotifications`, `clearNotifications` |
| `test/task-postprocess.test.js` | `scripts/task-postprocess.js` — config mode and post mode, invoked as a subprocess |
| `test/task-runner.test.js` | `scripts/task-runner.sh` — integration tests using fake commands, invoked as a subprocess |

### Approach

- Each test file creates an isolated `mkdtemp` directory and sets `HOME` to it before importing the module under test, so no test writes to `~/.tide`.
- `src/lib` modules are imported with a `?bust=N` cache-buster to get a fresh module instance bound to the temp `HOME`.
- Script tests (`task-postprocess`, `task-runner`) use `spawnSync` to invoke the real script with `HOME` pointed at a temp dir and fake commands that exit with controlled codes.
- `task-runner.sh` tests are macOS/zsh-only (matching the project's target platform).
