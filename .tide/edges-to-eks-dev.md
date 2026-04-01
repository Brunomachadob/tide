---
id: 529b1778
name: Edges to EKS - DEV
schedule: 30m
command: /opt/homebrew/bin/claude26 --permission-mode bypassPermissions --output-format=stream-json --include-partial-messages --verbose -p
workingDirectory: /Users/brunobrandao/n26/git
claudeStreamJson: true
---

Look for subtasks of https://number26-jira.atlassian.net/browse/RUN-1665.
Each execution should take the edge name from the ticket title and call the command "/edges-eks-migration {edge} dev continue"
