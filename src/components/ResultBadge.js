import React from 'react'
import { Text } from 'ink'
import Spinner from 'ink-spinner'

export default function ResultBadge({ result }) {
  if (!result) return React.createElement(Text, { color: 'gray' }, '-')
  if (!result.completedAt) return React.createElement(
    Text, { color: 'yellow' },
    React.createElement(Spinner, { type: 'dots' }),
    ' running',
  )
  if (result.exitCode === 0) return React.createElement(Text, { color: 'green' }, '✓ ok')
  return React.createElement(Text, { color: 'red' }, `✗ exit ${result.exitCode}`)
}
