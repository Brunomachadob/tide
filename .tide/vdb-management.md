---
id: 9c06b19a
name: vdb-management
schedule: 24h
command: /opt/homebrew/bin/claude26 --permission-mode bypassPermissions --output-format=stream-json --include-partial-messages --verbose -p
workingDirectory: /Users/brunobrandao/n26/git
claudeStreamJson: true
---

Run /vdb-management to look for VDB tickets to be performed. Ignore tickets about ubuntu and underlying OS packages. Focus on dependency vulnerabilities of backend servers (java, kotlin, go, python). Take *at most 5 tickets* per run.
