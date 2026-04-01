---
name: ping
schedule: 1h
command: >-
  /opt/homebrew/bin/claude26 --permission-mode bypassPermissions
  --output-format=stream-json --include-partial-messages --verbose -p
workingDirectory: /Users/brunobrandao
claudeStreamJson: true
_id: 036b8712
_createdAt: '2026-03-30T09:56:46Z'
_jitter: 55
_enabled: true
---

ping
