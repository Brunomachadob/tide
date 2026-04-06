# Notifications

## How they work

Every completed task run — success or failure — is tracked by Tide and fires a native macOS notification. Runs accumulate in the Notifications screen until you clear them.

## Viewing notifications

Press `N` on the task list to open the Notifications screen. Each entry shows:

- Task name
- Run timestamp
- Exit code (0 = success, non-zero = failure)
- Output summary (first N characters of stdout/stderr)

Press `c` to clear all pending notifications.

## Native macOS notifications

Each run fires a system notification with:
- **Title:** The task name and a ✓/✗ indicator
- **Body:** Completion status or exit code

These appear in Notification Center. You can configure them in System Settings → Notifications.

### Clicking a notification

If [`terminal-notifier`](https://github.com/julienXX/terminal-notifier) is installed (`brew install terminal-notifier`), clicking a notification dismisses it. Without it, Tide falls back to `osascript`.

::: tip Notification permissions
On first run, macOS may prompt you to allow notifications. If you installed `terminal-notifier`, allow notifications for it specifically — that's what sends them when it's available.
:::

## Design rationale

Completed tasks are never silently discarded:

1. You always know when a task ran, even if Tide wasn't open
2. Results persist until you actively clear them — no notification is lost on a restart
3. The Notifications screen is a lightweight review surface, not a log viewer (use the Logs screen for detailed output)
