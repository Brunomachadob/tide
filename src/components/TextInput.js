import React, { useState, useEffect } from 'react'
import { Box, Text, useInput } from 'ink'

/**
 * Single-line or multi-line text input using raw useInput.
 *
 * Props:
 *   value       string   current value
 *   onChange    fn       called with new string on every keystroke
 *   active      bool     whether this field captures input
 *   placeholder string   shown when value is empty and inactive
 *   multiline   bool     if true, Enter inserts \n instead of being ignored
 */
export default function TextInput({ value, onChange, active, placeholder = '', multiline = false }) {
  const [cursorVisible, setCursorVisible] = useState(true)

  // Blink cursor when active
  useEffect(() => {
    if (!active) { setCursorVisible(true); return }
    const id = setInterval(() => setCursorVisible(v => !v), 530)
    return () => clearInterval(id)
  }, [active])

  useInput((input, key) => {
    if (!active) return

    if (key.backspace || key.delete) {
      onChange(value.slice(0, -1))
    } else if (key.return) {
      if (multiline) onChange(value + '\n')
      // single-line: Enter is handled by the parent screen to advance step
    } else if (!key.ctrl && !key.meta && !key.escape && !key.tab && input) {
      onChange(value + input)
    }
  }, { isActive: active })

  const displayLines = value.split('\n')
  const lastLine = displayLines[displayLines.length - 1]
  const cursor = active && cursorVisible ? '█' : active ? '▏' : ''

  const color = active ? 'white' : 'gray'

  if (!value && !active) {
    return React.createElement(Text, { color: 'gray' }, placeholder)
  }

  if (multiline && displayLines.length > 1) {
    return React.createElement(
      Box,
      { flexDirection: 'column' },
      ...displayLines.slice(0, -1).map((line, i) =>
        React.createElement(Text, { key: i, color }, line || ' '),
      ),
      React.createElement(Text, { color }, lastLine + cursor),
    )
  }

  return React.createElement(Text, { color }, (value || '') + cursor)
}
