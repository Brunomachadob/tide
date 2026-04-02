import React from 'react'
import { Box, Text } from 'ink'

// scopeToggle: { label: string } — renders a scope indicator in the subtitle line
export default function Header({ breadcrumb, scopeToggle, notificationCount = 0 }) {
  const subtitle = scopeToggle
    ? React.createElement(Box, { gap: 1 },
        React.createElement(Text, { color: 'gray' }, '[Tab]'),
        React.createElement(Text, { color: 'cyan' }, scopeToggle.label + ' ▾'),
      )
    : breadcrumb
    ? React.createElement(Text, { bold: true }, breadcrumb)
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
