import React from 'react'
import { Box, Text } from 'ink'
import useTheme from '../hooks/useTheme.js'

// workspaceToggle: { label: string, color?: string } — renders a workspace indicator in the subtitle line
// workspaceColor: color applied to the border and subtitle elements (defaults to accent)
export default function Header({ breadcrumb, workspaceToggle, workspaceColor, notificationCount = 0 }) {
  const { accent } = useTheme()
  const chrome = workspaceColor ?? accent
  const subtitle = workspaceToggle
    ? React.createElement(Box, { gap: 1 },
        React.createElement(Text, { color: chrome }, '[Tab]'),
        React.createElement(Text, { color: chrome }, '▾ ' + workspaceToggle.label),
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
    { flexDirection: 'column', borderStyle: 'single', borderColor: chrome, paddingX: 1, marginBottom: 1 },
    React.createElement(
      Box,
      { justifyContent: 'space-between' },
      React.createElement(Text, { bold: true, color: accent }, '≋ Tide'),
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
