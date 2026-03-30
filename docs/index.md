---
layout: home

hero:
  name: Tide
  text: macOS task scheduler with a terminal UI
  tagline: Run any command on a schedule using launchd.
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: What is Tide?
      link: /guide/what-is-tide


features:
  - icon: ⏱️
    title: Persistent scheduling
    details: Tasks run on schedule via <a href="https://developer.apple.com/library/archive/documentation/MacOSX/Conceptual/BPSystemStartup/Chapters/CreatingLaunchdJobs.html" target="_blank">macOS launchd</a> — no active session required. Close your terminal and tasks keep running.
  - icon: 🖥️
    title: Terminal UI
    details: A live TUI shows task status, last result, logs, and notifications. Navigate with keyboard shortcuts, no config files to edit.
  - icon: 🔔
    title: Never miss a result
    details: Every run appends to pending-notifications.json and fires a native macOS notification. Results are never silently discarded.
  - icon: 🔁
    title: Retry support
    details: Configure per-task max retries with exponential backoff.
---
