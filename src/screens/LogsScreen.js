import React, { useState, useCallback } from 'react'
import { Box, Text, useInput } from 'ink'
import Spinner from 'ink-spinner'
import { useLogs } from '../hooks/useLogs.js'
import { useNotifications } from '../hooks/useNotifications.js'
import Header from '../components/Header.js'
import KeyHints from '../components/KeyHints.js'

const LINE_OPTIONS = [50, 100, 200, 500]

export default function LogsScreen({ taskId, navigate, goBack }) {
  const [tab, setTab] = useState('output')   // 'output' | 'stderr'
  const [lineIdx, setLineIdx] = useState(0)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const lines = LINE_OPTIONS[lineIdx]

  const { output, stderr, outputTotal, stderrTotal, loading, refresh } = useLogs(taskId, lines, autoRefresh)
  const { notifications } = useNotifications(10000)

  useInput((input, key) => {
    if (key.escape || input === 'q') { goBack(); return }
    if (key.tab || input === '\t') setTab(t => t === 'output' ? 'stderr' : 'output')
    if (input === 'f') setAutoRefresh(a => !a)
    if (input === 'r') refresh()
    if (input === 'n') navigate('notifications')
    if (input === 's') navigate('settings')
    if (input === '+' || input === ']') setLineIdx(i => Math.min(LINE_OPTIONS.length - 1, i + 1))
    if (input === '-' || input === '[') setLineIdx(i => Math.max(0, i - 1))
  })

  const content = tab === 'output' ? output : stderr
  const total = tab === 'output' ? outputTotal : stderrTotal
  const tabLabel = tab === 'output' ? 'OUTPUT' : 'STDERR'
  const truncationHint = total != null && total > lines
    ? `(showing last ${lines} of ${total} lines)`
    : null

  return React.createElement(
    Box,
    { flexDirection: 'column' },
    React.createElement(Header, {
      title: `Logs — ${tab === 'output' ? 'Output' : 'Stderr'} (last ${lines} lines)`,
      notificationCount: notifications.length,
    }),

    truncationHint
      ? React.createElement(Box, { paddingX: 1 },
          React.createElement(Text, { color: 'yellow' }, truncationHint),
        )
      : null,

    React.createElement(
      Box,
      { paddingX: 1, gap: 2, marginBottom: 1 },
      React.createElement(Text,
        { color: tab === 'output' ? 'cyan' : 'gray', underline: tab === 'output' },
        'OUTPUT',
      ),
      React.createElement(Text,
        { color: tab === 'stderr' ? 'cyan' : 'gray', underline: tab === 'stderr' },
        'STDERR',
      ),
      React.createElement(Text, { color: 'gray' }, '│'),
      React.createElement(Text, { color: autoRefresh ? 'green' : 'gray' },
        autoRefresh ? '● auto-refresh on' : '○ auto-refresh off',
      ),
    ),

    loading
      ? React.createElement(Box, { padding: 1 },
          React.createElement(Spinner, { type: 'dots' }),
          React.createElement(Text, null, ' Loading logs...'),
        )
      : React.createElement(
          Box,
          { borderStyle: 'single', borderColor: 'gray', paddingX: 1, flexDirection: 'column' },
          content == null
            ? React.createElement(Text, { color: 'gray' }, '(no log yet — task hasn\'t run)')
            : content === ''
            ? React.createElement(Text, { color: 'gray' }, '(empty)')
            : React.createElement(Text, null, content),
        ),

    React.createElement(KeyHints, {
      hints: [
        ['Esc/q', 'back'],
        ['Tab', 'switch tab'],
        ['f', 'toggle follow'],
        ['+/-', 'line count'],
        ['r', 'refresh'],
      ],
    }),
  )
}
