import React from 'react'
import { Box, Text } from 'ink'
import useTheme from '../hooks/useTheme.js'

export default function FieldBox({ label, active, children }) {
  const { accent } = useTheme()
  return React.createElement(
    Box,
    {
      flexDirection: 'column',
      borderStyle: active ? 'round' : 'single',
      borderColor: active ? accent : 'gray',
      paddingX: 1, marginBottom: 1,
    },
    React.createElement(Text, { color: active ? accent : 'gray', bold: active }, label),
    children,
  )
}
