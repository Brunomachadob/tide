import React from 'react'
import { Text } from 'ink'
import Spinner from 'ink-spinner'

export default function StatusBadge({ status }) {
  if (status === 'running') {
    return React.createElement(
      Text, { color: 'green' },
      React.createElement(Spinner, { type: 'dots' }),
      ' running',
    )
  }

  const map = {
    loaded:      ['cyan',   '○ loaded'],
    disabled:    ['gray',   '- disabled'],
    'not loaded': ['yellow', '! not loaded'],
  }
  const [color, label] = map[status] || ['white', status]
  return React.createElement(Text, { color }, label)
}
