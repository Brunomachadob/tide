import React, { useEffect } from 'react'
import { Box, Text } from 'ink'
import useTheme from '../hooks/useTheme.js'

export default function Toast({ message, type = 'info', onDone }) {
  const { accent } = useTheme()
  useEffect(() => {
    const id = setTimeout(onDone, 2500)
    return () => clearTimeout(id)
  }, [onDone])

  const color = type === 'error' ? 'red' : type === 'success' ? 'green' : accent
  return React.createElement(
    Box,
    { borderStyle: 'round', borderColor: color, paddingX: 1 },
    React.createElement(Text, { color }, message),
  )
}
