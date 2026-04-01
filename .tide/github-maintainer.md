---
_id: 3ac4d658
_createdAt: '2026-03-31T08:18:09Z'
_jitter: 144
_enabled: false
name: Tide - GitHub Maintainer
schedule: 15m
command: >-
  /opt/homebrew/bin/claude26 --permission-mode bypassPermissions
  --output-format=stream-json --include-partial-messages --verbose -p
workingDirectory: /Users/brunobrandao/git/tide
claudeStreamJson: true
---

Read prompts/github-maintainer.md and follow its instructions exactly.
