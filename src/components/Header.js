import React from 'react'
import { Box, Text } from 'ink'

// workspaceToggle: { label: string } — renders a workspace indicator in the subtitle line
export default function Header({ breadcrumb, workspaceToggle, notificationCount = 0 }) {
  const subtitle = workspaceToggle
    ? React.createElement(Box, { gap: 1 },
        React.createElement(Text, { color: 'gray' }, '[Tab]'),
        React.createElement(Text, { color: 'cyan' }, '▾ ' + workspaceToggle.label),
      )
    : breadcrumb
    ? (() => {
        const match = breadcrumb.match(/^(.*?)(\s*\([0-9a-f]+\))(.*)$/)
        if (!match) return React.createElement(Text, { bold: true }, breadcrumb)
        return React.createElement(Box, null,
          React.createElement(Text, { bold: true }, match[1]),
          React.createElement(Text, { bold: true, dimColor: true }, match[2]),
          match[3] ? React.createElement(Text, { bold: true }, match[3]) : null,
        )
      })()
    : null

  return React.createElement(
    Box,
    { flexDirection: 'column', borderStyle: 'single', borderColor: 'cyan', paddingX: 1, marginBottom: 1 },
    React.createElement(
      Box,
      { justifyContent: 'space-between' },
      React.createElement(Text, { bold: true, color: 'cyan' }, '≋ Tide'),
      React.createElement(
        Box,
        { gap: 2 },
        notificationCount > 0
          ? React.createElement(Text, { color: 'yellow' }, `[n] notifications (${notificationCount} unread)`)
          : React.createElement(Text, { color: 'gray' }, '[n] notifications'),
        React.createElement(Text, { color: 'gray' }, '[s] settings'),
      ),
    ),
    subtitle,
  )
}
