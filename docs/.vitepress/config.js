import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Tide',
  description: 'macOS task scheduler with a terminal UI — run Claude agents on a schedule using launchd',
  base: '/tide/',

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/tide/favicon.svg' }],
    ['meta', { name: 'theme-color', content: '#3c82f6' }],
  ],

  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/what-is-tide' },
      { text: 'Reference', link: '/reference/task-model' },
      { text: 'ADRs', link: '/adr/0001-interval-only-scheduling' },
    ],

    sidebar: [
      {
        text: 'Introduction',
        items: [
          { text: 'What is Tide?', link: '/guide/what-is-tide' },
          { text: 'Getting Started', link: '/guide/getting-started' },
        ],
      },
      {
        text: 'Guide',
        items: [
          { text: 'Creating Tasks', link: '/guide/creating-tasks' },
          { text: 'Scheduling', link: '/guide/scheduling' },
          { text: 'Retries', link: '/guide/retries' },
          { text: 'Notifications', link: '/guide/notifications' },
          { text: 'Logs & Results', link: '/guide/logs-and-results' },
          { text: 'Settings', link: '/guide/settings' },
        ],
      },
      {
        text: 'Reference',
        items: [
          { text: 'Task Model', link: '/reference/task-model' },
          { text: 'Data Directory', link: '/reference/data-directory' },
          { text: 'Screens', link: '/reference/screens' },
        ],
      },
      {
        text: 'Architecture Decisions',
        items: [
          { text: 'ADR-0001: Interval Scheduling', link: '/adr/0001-interval-only-scheduling' },
          { text: 'ADR-0002: task.json as Truth', link: '/adr/0002-task-json-as-source-of-truth' },
          { text: 'ADR-0003: eval for Shell Config', link: '/adr/0003-eval-for-shell-config' },
          { text: 'ADR-0004: Claude stream-json Logs', link: '/adr/0004-claude-stream-json-for-real-time-logs' },
          { text: 'ADR-0005: Custom Markdown Renderer', link: '/adr/0005-custom-markdown-renderer' },
          { text: 'ADR-0006: Markdown Task Files', link: '/adr/0006-markdown-task-files' },
          { text: 'ADR-0007: Non-blocking UI Refresh', link: '/adr/0007-non-blocking-ui-refresh' },
          { text: 'ADR-0008: Multi-repo Scope', link: '/adr/0008-multi-repo-scope' },
          { text: 'ADR-0009: Agent SDK Runner', link: '/adr/0009-agent-runner-sdk' },
        ],
      },
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/Brunomachadob/tide' },
    ],

    footer: {
      message: 'Released under the <a href="https://github.com/Brunomachadob/tide/blob/main/LICENSE">MIT License</a>.',
    },

    search: {
      provider: 'local',
    },
  },
})
