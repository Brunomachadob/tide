import React from 'react'
import { Box, Text, useInput } from 'ink'

export default function ConfirmDialog({ message, onConfirm, onCancel }) {
  useInput((input, key) => {
    if (key.return) onConfirm()
    if (key.escape) onCancel()
  })

  return React.createElement(
    Box,
    { flexDirection: 'column', borderStyle: 'round', borderColor: 'yellow', paddingX: 2, paddingY: 1 },
    React.createElement(Text, { color: 'yellow', bold: true }, 'Confirm'),
    React.createElement(Text, null, message),
    React.createElement(Box, { marginTop: 1 },
      React.createElement(Text, { color: 'green' }, '[↵] Yes'),
      React.createElement(Text, { color: 'gray' }, '  '),
      React.createElement(Text, { color: 'red' }, '[Esc] No'),
    ),
  )
}
