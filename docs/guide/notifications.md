# Notifications

## How they work

Every completed task run — success or failure — appends an entry to `~/.tide/pending-notifications.json`. Tide also fires a native macOS notification via `osascript`.

The pending-notifications file accumulates entries until you open the Notifications screen and clear them.

## Viewing notifications

Press `N` on the task list to open the Notifications screen. Each entry shows:

- Task name
- Run timestamp
- Exit code (0 = success, non-zero = failure)
- Output summary (first N characters of stdout/stderr)

Press `c` to clear all pending notifications.

## Native macOS notifications

Each run fires a system notification with:
- **Title:** The task name
- **Body:** Exit code and brief output summary

These appear in Notification Center. You can configure them in System Settings → Notifications.

::: tip Notification permissions
On first run, macOS may prompt you to allow notifications from the terminal app running the task. Allow this to receive notifications. If you deny it, tasks still complete and results are still recorded — only the system notification is suppressed.
:::

## The pending-notifications.json file

```json
[
  {
    "taskId": "3f640f65",
    "taskName": "Daily git summary",
    "exitCode": 0,
    "startedAt": "2026-03-30T10:00:00Z",
    "finishedAt": "2026-03-30T10:00:45Z",
    "outputSummary": "Found 12 commits across 3 repos..."
  }
]
```

The file is created on first write by `task-postprocess.js`. It does not exist until at least one task has run.

::: warning File format
`pending-notifications.json` is written atomically (temp-then-rename). Do not hold a long-lived file descriptor open to it — reads should open, parse, and close.
:::

## Design rationale

Completed tasks are never silently discarded. The notification model ensures:

1. You always know when a task ran, even if Tide wasn't open
2. Results persist until you actively clear them — no notification is lost on a restart
3. The Notifications screen is a lightweight review surface, not a log viewer (use the Logs screen for detailed output)
