# ADR-0009: Key Binding Conventions
Date: 2026-04-03
Status: Accepted

## Context

After several incremental feature additions, the keyboard interface had accumulated inconsistencies: bare letters used for destructive actions while modified keys (Ctrl+) were used for lighter ones; labels in the hint bar that did not match the action performed; undocumented hidden keys; and no written policy to guide future additions. This ADR establishes the conventions applied during the issue-#28 audit and acts as policy for all future key binding decisions.

## Decision

### Modifier conventions

| Pattern | Use for |
|---------|---------|
| Bare letter (`r`, `e`, `d`) | Reversible or frequently-used actions |
| `Ctrl+<letter>` | Destructive, infrequent, or heavy actions (spawns editor, syncs launchd, clears data) |
| `Shift+<letter>` (capital) | Bulk variants of the bare letter's action (`S` = sync all, `S` relates to `Ctrl+S` per-item) |

**Rule:** if two bindings on the same key letter differ only by modifier, the more destructive action always gets the modifier.

Applied fix: `r`/`Ctrl+R` in Notifications were inverted. `r` (bare) now marks-all-read (non-destructive); `Ctrl+R` now clears read notifications (destructive — removes items).

### Navigation / "back"

`Esc` and `q` are universal back/quit. `←` (left arrow) is additionally accepted as "back" in detail views where spatial navigation is natural (RunDetail). This dual-paradigm is intentional and should be preserved; it does not need to be unified.

### Key letter choice

- Prefer mnemonics: `r` = run/refresh, `e` = enable/disable, `d` = delete, `l` = latest, `x` = all runs (e**x**ecutions), `f` = follow-up, `o` = open, `c` = create/clear, `s` = settings, `n` = notifications.
- Avoid repurposing the same letter for unrelated actions across screens when possible. (Exception: `c` means "create" in the task list and "clear all" in Notifications; accepted because the screens are distinct.)

### Hint bar

- Every key that users are expected to discover must appear in the hint bar.
- Aliases (`][` for `+-`) must be shown alongside the primary binding, e.g. `+]/−[`.
- Labels must match the action performed, not a synonym. (`l` opens "latest run", not "logs".)
- Context-sensitive keys (only relevant in certain states) may be shown conditionally (e.g. `k` kill only when running, `Ctrl+S` sync only when pending, `f` follow-up only when completed).

### `Ctrl+E` safety

`Ctrl+E` opens the task's source file in `$EDITOR`. When a task has no `sourcePath`, a toast error is shown rather than calling `spawnSync` with `undefined` (which would crash).

## Consequences

- Key bindings across all screens now follow a consistent modifier model.
- The hint bar is complete and accurate for all screens.
- `docs/reference/screens.md` is the canonical reference for all shortcuts; it must be kept in sync with code changes.
- Future contributors must consult this ADR before adding or changing a key binding.
