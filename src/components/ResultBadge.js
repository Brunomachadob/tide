import React from 'react'
import { Text } from 'ink'

export default function ResultBadge({ result }) {
  if (!result) return React.createElement(Text, { color: 'gray' }, '-')
  if (result.exitCode === 0) return React.createElement(Text, { color: 'green' }, '✓ ok')
  return React.createElement(Text, { color: 'red' }, `✗ exit ${result.exitCode}`)
}
