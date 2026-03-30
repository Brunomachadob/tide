import React from 'react'
import { Box, Text } from 'ink'

export default function Header({ title, subtitle, notificationCount = 0, onNotifications, onSettings }) {
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
          ? React.createElement(Text, { color: 'yellow' }, `[n] notifs (${notificationCount})`)
          : React.createElement(Text, { color: 'gray' }, '[n] notifs'),
        React.createElement(Text, { color: 'gray' }, '[s] settings'),
      ),
    ),
    title
      ? React.createElement(Text, { bold: true }, title)
      : null,
  )
}
