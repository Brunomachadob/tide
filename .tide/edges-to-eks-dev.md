_jitter: 95
_enabled: true
---
name: Edges to EKS - DEV
schedule: 30m
command: /opt/homebrew/bin/claude26 --permission-mode bypassPermissions -p
workingDirectory: /Users/brunobrandao/n26/git
claudeStreamJson: false
_id: "21366c0f"
_createdAt: "2026-03-31T15:36:01Z"
_jitter: 95
_enabled: true
env:
  CLAUDE_CODE_MAX_OUTPUT_TOKENS: '8192'
---

You are orchestrating the EKS migration for Edge services in the DEV environment.

## Step 1 — Discover edges to work on

Use the Jira MCP to fetch all subtasks of RUN-1665. For each subtask:
- Extract the edge name from the ticket title (e.g. "atlassianedge" from "RUN-1709 — `atlassianedge dev`")
- Skip any subtask whose status is "Done" or "Cancelled"
- Skip ignored edges: mambuedge, any edge starting with "test", any edge starting with "web"

## Step 2 — Spawn executor agents in parallel

For each remaining edge, use the Agent tool with:
- subagent_type: "edges-eks-migration:edges-eks-migration-executor"
- description: "Execute continue for {edge} in dev"
- prompt:
  ```
  Execute EKS migration for the following edge service:

  Edge: {edge}
  Environment: dev
  Action: continue

  Perform the requested action according to the migration phases.
  ```

Run all agents in parallel (up to 5 at a time). Collect their results.

## Step 3 — Update Rollout Summary

After all agents complete, update the Rollout Summary table in Confluence (page ID: 4632117272, cloud ID: 88ee171b-941c-4f1e-a762-25e49b508245).
For each edge processed, update its row with: current phase, status, last updated timestamp, and any notes/blockers from the agent output.

## Step 4 — Print summary

Print a summary table of all edges processed, their current phase, status, and any blockers.
