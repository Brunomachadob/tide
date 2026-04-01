---
name: vdb-management
schedule: 24h
command: /opt/homebrew/bin/claude26 --permission-mode bypassPermissions -p
workingDirectory: /Users/brunobrandao/n26/git
claudeStreamJson: false
_id: 9c06b19a
_createdAt: '2026-03-29T22:47:41Z'
_jitter: 123
_enabled: true
---

Run /vdb-management to look for VDB tickets to be performed. Ignore tickets about ubuntu and underlying OS packages. Focus on dependency vulnerabilities of backend servers (java, kotlin, go, python). Take *at most 5 tickets* per run.
