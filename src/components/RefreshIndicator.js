import React from 'react'
import { Box, Text } from 'ink'
import Spinner from 'ink-spinner'

export default function RefreshIndicator({ intervalMs, loading }) {
  const secs = Math.round(intervalMs / 1000)
  if (loading) {
    return React.createElement(
      Box, { gap: 1 },
      React.createElement(Spinner, { type: 'dots' }),
      React.createElement(Text, { color: 'gray' }, `${secs}s`),
    )
  }
  return React.createElement(Text, { color: 'gray' }, `↻ ${secs}s`)
}
