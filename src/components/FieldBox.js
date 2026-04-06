import React from 'react'
import { Box, Text } from 'ink'

export default function FieldBox({ label, active, children }) {
  return React.createElement(
    Box,
    {
      flexDirection: 'column',
      borderStyle: active ? 'round' : 'single',
      borderColor: active ? 'cyan' : 'gray',
      paddingX: 1, marginBottom: 1,
    },
    React.createElement(Text, { color: active ? 'cyan' : 'gray', bold: active }, label),
    children,
  )
}
