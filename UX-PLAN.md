# UX Improvement Plan

Quick wins identified from a full audit of all screens. Ordered by impact/effort ratio.

---

## 1. Log line count visible in header

**File:** `src/screens/LogsScreen.js`

**Problem:** Pressing `+`/`-` changes the line count but nothing in the UI reflects the current value until the log re-renders. User doesn't know if the keypress worked.

**Fix:** Show the current line count in the tab/header area, e.g. `stdout (last 50 lines)`.

---

## 2. Date format picker — show examples

**File:** `src/screens/SettingsScreen.js`

**Problem:** The date format options show the format name (`YYYY-MM-DD`, `DD.MM.YYYY`, `MM/DD/YYYY`) but not what an actual date looks like in each format. User has to guess.

**Fix:** Render a concrete example next to each option using today's date, e.g.:
```
YYYY-MM-DD   → 2026-03-30
DD.MM.YYYY   → 30.03.2026
MM/DD/YYYY   → 03/30/2026
```

---

## 3. "not loaded" status — add recovery hint

**File:** `src/screens/TaskListScreen.js`, `src/screens/TaskDetailScreen.js`

**Problem:** A task shows `! not loaded` when its plist is missing or unregistered with launchd. The user has no idea why or what to do.

**Fix:** In the task detail screen, when status is `not loaded`, add a line below the status row:
```
  → press 'e' to re-register with launchd
```

---

## 4. Sparkline of last N exit codes on task list

**File:** `src/screens/TaskListScreen.js`, `src/hooks/useTasks.js`

**Problem:** The RESULT column shows only the latest result. A task could be failing repeatedly and the user has no at-a-glance signal.

**Fix:** Replace or augment the RESULT column with a sparkline of the last 5–10 exit codes using block characters, e.g.:
```
✓ ✓ ✓ ✗ ✓
```
Use `getResults(id, 10)` which is already called via `useTasks`. Color green/red per exit code.

---

## 5. Log truncation hint

**File:** `src/screens/LogsScreen.js`

**Problem:** Logs are capped at N lines but there's no indication that the file has more content above what's shown.

**Fix:** Read the actual line count of the file (or file size) and if the file has more lines than the current limit, show a header like `(showing last 50 of 312 lines)`.

---

## Out of scope (decided against)

- **Next fire time** — requires deeper launchctl parsing or plist re-reading; not worth the complexity for now.
- **Selective notification clear** — overkill for a personal tool.
- **"Test command" button** in Settings — scope creep; README documents this.
- **Retry strategy details** in Results — the `attempts` count is sufficient.
