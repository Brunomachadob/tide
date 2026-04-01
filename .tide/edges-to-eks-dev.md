---
name: Edges to EKS - DEV
schedule: 30m
command: /opt/homebrew/bin/claude26 --permission-mode bypassPermissions -p
workingDirectory: /Users/brunobrandao/n26/git
claudeStreamJson: false
_id: 529b1778
_createdAt: '2026-03-31T15:36:01Z'
_jitter: 95
_enabled: true
---

Look for subtasks of https://number26-jira.atlassian.net/browse/RUN-1665.
Each execution should take the edge name from the ticket title and call the command "/edges-eks-migration {edge} dev continue"
