# ADR-0001: Interval-only scheduling
Date: 2026-03-30
Status: Accepted

## Context

The initial design considered two scheduling models:

- **Interval** — fire every N seconds after the previous run (`StartInterval` in launchd)
- **Calendar** — fire at a specific time of day or on a cron-like expression (`StartCalendarInterval` in launchd)

Calendar scheduling is attractive for use cases like "run at 9am every weekday". However, launchd's behavior on a laptop with sleep/wake cycles makes it unreliable:

- `StartCalendarInterval` jobs that were missed while the machine slept are **silently skipped** — launchd does not catch up on missed calendar triggers.
- `StartInterval` jobs behave differently: if the interval elapsed during sleep, the job fires once immediately on wake.

Since Tide targets personal MacBooks that are frequently closed and reopened, silent skips would be a common experience. An interval model with a random per-task jitter (0–min(interval/4, 300)s) is a better fit: tasks catch up on wake and the jitter prevents all tasks firing simultaneously.

## Decision

Tide supports only interval-based schedules (`{ type: "interval", intervalSeconds: N }`). Calendar scheduling is not implemented.

## Consequences

- Users cannot express "run at 9am daily" — only "run every 24 hours". This is a meaningful UX limitation for time-sensitive tasks.
- Tasks fired on wake may land at unpredictable clock times, which is acceptable for the primary use case (LLM prompts, summaries, health checks).
- If macOS ever fixes missed-calendar-trigger catch-up behavior, or if Tide gains a persistent daemon that can simulate calendar scheduling over intervals, this decision can be revisited.
