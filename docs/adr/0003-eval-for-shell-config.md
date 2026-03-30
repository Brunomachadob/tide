# ADR-0003: Using eval to pass config from task-setup.js to task-runner.sh
Date: 2026-03-30
Status: Accepted

## Context

`task-runner.sh` is a zsh script that needs several values from `task.json` (command, argument, retries, jitter, etc.). The shell cannot parse JSON natively, so a Node helper (`task-setup.js`) reads the file and emits shell variable assignments that the shell evaluates:

```sh
eval "$(node task-setup.js task.json)"
```

`eval` has a reputation as a security risk because it executes arbitrary shell code. The concern would be: if a malicious value were injected into `task.json`, it could be executed by the shell when the variables are evaluated.

`task-setup.js` does quote all values using single-quote escaping (`'...'` with `'\''` for embedded single quotes), which correctly neutralizes shell metacharacters. However, it is worth documenting why `eval` is considered acceptable here rather than relying solely on the quoting implementation.

## Decision

`eval` is acceptable for this use case. `task.json` lives in `~/.tide/tasks/<id>/task.json`, a path owned and writable only by the current user. An attacker who can write to that path already has full write access to the user's home directory — at which point they can modify `.zshrc`, `.ssh/authorized_keys`, launchd plists, or any other user-owned file to achieve arbitrary code execution through far simpler means. The `eval` surface adds no meaningful attack vector beyond what already exists.

Alternatives considered:

- **Pass values as CLI arguments to task-runner.sh** — launchd's `ProgramArguments` is static at plist-write time; runtime values like `argument` and `maxRetries` would still need to be read dynamically.
- **Source a generated env file** — same trust boundary as `eval`; sourcing a file the user owns is equivalent.
- **Rewrite task-runner.sh in Node** — eliminates the shell/Node boundary entirely but loses the simplicity of a thin shell wrapper and complicates process management.

## Consequences

- The quoting implementation in `task-setup.js` must remain correct. Any future fields added to the emitted output must use the same `q()` helper.
- This decision is scoped to a single-user personal tool. A multi-user or networked deployment would require a different trust model.
