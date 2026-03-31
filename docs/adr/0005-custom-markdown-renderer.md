# ADR-0005: Custom Markdown Renderer for Log Output
Date: 2026-03-31
Status: Accepted

## Context

Run output in Tide is primarily Claude's responses, which are written in markdown. Rendering raw markdown in the terminal log viewer is hard to read — headers look like `# Title`, bold text appears as `**word**`, and code blocks are indistinguishable from prose.

Adding a third-party library (`marked-terminal`) would handle this, but it brings 8 transitive dependencies including `chalk`, `cli-highlight`, and `node-emoji` — none of which are needed for the subset of markdown Claude typically produces (headers, bold, italic, inline code, fenced code blocks, blockquotes, bullet lists).

Ink, the terminal UI framework Tide uses, renders `<Text>` nodes as plain strings with ANSI escape codes. Any markdown renderer must ultimately produce ANSI-escaped strings to be useful in this context.

## Decision

Implement a small custom markdown-to-ANSI renderer in `src/lib/markdown.js` (~50 lines) with zero dependencies. It covers:

- **Headers** (h1–h3): bold + underline for h1/h2, bold only for h3
- **Bold** (`**text**`): `\x1b[1m`
- **Italic** (`*text*`): `\x1b[3m`
- **Inline code** (`` `code` ``): reverse video (`\x1b[7m`) — visually distinct "token" treatment
- **Fenced code blocks** (` ``` `): dim text + `│ ` prefix per line — "region" treatment that matches inline code aesthetically without using the same escape
- **Blockquotes** (`> text`): dim + cyan `│ ` prefix
- **Bullet lists** (`- ` / `* `): replaced with `  •`

Fenced code block content is protected from inline transforms via a placeholder-then-restore technique, preventing double-processing of backticks or asterisks inside code blocks.

Rendering is applied to the **output tab only** in `RunsScreen`'s `RunDetail` component. The stderr tab remains raw, since stderr is process/tool output rather than formatted content.

## Consequences

- Zero new dependencies; the renderer is a pure function with no I/O
- Only the markdown subset Claude actually produces is supported — tables, nested lists, and HTML pass through as plain text
- Any future need for syntax highlighting inside code blocks would require either extending this renderer or replacing it with a library
- The renderer is tested independently in `test/markdown.test.js`
