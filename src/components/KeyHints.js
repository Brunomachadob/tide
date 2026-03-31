import React from 'react'
import { Box, Text } from 'ink'

export default function KeyHints({ hints, refreshIndicator }) {
  return React.createElement(
    Box,
    { borderStyle: 'single', borderColor: 'gray', paddingX: 1, justifyContent: 'space-between' },
    React.createElement(
      Box,
      null,
      ...hints.map(([key, label], i) =>
        React.createElement(
          Box,
          { key: i, marginRight: 2 },
          React.createElement(Text, { color: 'cyan', bold: true }, key),
          React.createElement(Text, { color: 'gray' }, ' ' + label),
        ),
      ),
    ),
    refreshIndicator ?? null,
  )
}
