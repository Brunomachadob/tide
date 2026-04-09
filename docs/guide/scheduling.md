# Scheduling

## Schedule types

Tide supports two schedule types:

### Interval

A task fires every N seconds after its previous run completes.

```json
"schedule": { "type": "interval", "intervalSeconds": 3600 }
```

Calendar-based scheduling ("run at 9am every weekday") is not supported. See [ADR-0001](/adr/0001-interval-only-scheduling) for the reasoning.

### Manual

A task with a manual schedule never fires automatically — it only runs when you explicitly trigger it with `r` (run now) from the task list or detail screen.

```json
"schedule": { "type": "manual" }
```

Manual tasks are useful when you want to reuse the same command, argument, and working directory on demand without setting up a recurring schedule. They are registered with launchd like any other task, but their plist has no `StartInterval` key, so launchd never fires them.

::: tip
Manual tasks still produce run history, logs, and notifications just like scheduled tasks.
:::

## Common intervals

| Interval | Seconds |
|----------|---------|
| 15 minutes | `900` |
| 30 minutes | `1800` |
| 1 hour | `3600` |
| 6 hours | `21600` |
| 12 hours | `43200` |
| 24 hours | `86400` |

## Jitter

At creation time, Tide assigns a random `jitterSeconds` value to each task:

```
jitter = random(0, min(intervalSeconds / 4, 300))
```

This jitter is applied before each run. Its purpose is to spread tasks out after a **sleep/wake cycle** — if your Mac was asleep for 6 hours and you have 5 tasks all with a 1-hour interval, without jitter they would all fire within milliseconds of each other on wake.

The maximum jitter is capped at **5 minutes** (300 seconds) regardless of interval length, so a 24-hour task still fires close to its intended time.

::: info Jitter is fixed at creation
`jitterSeconds` is assigned once when the task is created and stored in the plist as a `TIDE_JITTER` environment variable. It does not change between runs. To get a new jitter value, delete and recreate the task.
:::

## Sleep/wake behavior

launchd's `StartInterval` semantics on macOS:

- If your Mac is **awake** during the interval, the task fires at the expected time.
- If your Mac **sleeps** through an interval, launchd fires the task once immediately on wake, regardless of how many intervals were missed.

This means tasks will never pile up from missed runs — at most one catchup run fires per wake.

::: warning Tasks may run at unexpected clock times
Because tasks fire on interval (not at a fixed clock time), and because a wake event resets the timer, a task configured for "every 24 hours" might fire at 2am one day and 11pm the next. If your use case requires a specific time of day, Tide is not the right tool.
:::

## Under the hood

launchd is the scheduler — Tide doesn't implement any timer logic itself. The plist generated for each task uses:

```xml
<key>StartInterval</key>
<integer>3600</integer>
```

The jitter is applied in `agent-runner.js` before the agent is invoked, using the `TIDE_JITTER` env var written into the plist at creation time.

So the actual sequence is: launchd fires `tide.sh` → `agent-runner.js` starts → sleeps for jitter seconds → agent runs.
