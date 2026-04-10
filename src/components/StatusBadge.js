import React from 'react'
import { Text } from 'ink'
import Spinner from 'ink-spinner'
import useTheme from '../hooks/useTheme.js'

export default function StatusBadge({ status }) {
  const { accent } = useTheme()
  if (status === 'running') {
    return React.createElement(
      Text, { color: 'green' },
      React.createElement(Spinner, { type: 'dots' }),
      ' running',
    )
  }

  const map = {
    loaded:          [accent,   '○ loaded'],
    disabled:        ['gray',   '- disabled'],
    'not loaded':    ['yellow', '! not loaded'],
    'launchd-error': ['red',    '✗ launchd error'],
  }
  const [color, label] = map[status] || ['white', status]
  return React.createElement(Text, { color }, label)
}
