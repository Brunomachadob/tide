import React from 'react'
import { Text } from 'ink'

const STATUS_COLORS = {
  running: 'green',
  loaded: 'cyan',
  disabled: 'gray',
  'not loaded': 'yellow',
}

export default function StatusBadge({ status }) {
  const color = STATUS_COLORS[status] || 'white'
  const label = status === 'running' ? '● running' :
                status === 'loaded'  ? '○ loaded'  :
                status === 'disabled' ? '- disabled' :
                '! not loaded'
  return React.createElement(Text, { color }, label)
}
