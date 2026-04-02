import React from 'react'
import { Box, Text } from 'ink'

export default function Header({ breadcrumb, subtitle, notificationCount = 0 }) {
  return React.createElement(
    Box,
    { flexDirection: 'column', borderStyle: 'single', borderColor: 'cyan', paddingX: 1, marginBottom: 1 },
    React.createElement(
      Box,
      { justifyContent: 'space-between' },
      React.createElement(
        Box,
        null,
        React.createElement(Text, { bold: true, color: 'cyan' }, '≋ Tide'),
        subtitle
          ? React.createElement(Text, { color: 'gray' }, '  ' + subtitle)
          : null,
      ),
      React.createElement(
        Box,
        { gap: 2 },
        notificationCount > 0
          ? React.createElement(Text, { color: 'yellow' }, `[n] notifications (${notificationCount} unread)`)
          : React.createElement(Text, { color: 'gray' }, '[n] notifications'),
        React.createElement(Text, { color: 'gray' }, '[s] settings'),
      ),
    ),
    breadcrumb
      ? React.createElement(Text, { bold: true }, breadcrumb)
      : null,
  )
}
