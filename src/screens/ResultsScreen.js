import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import Spinner from 'ink-spinner'
import { useResults } from '../hooks/useResults.js'
import { useNotifications } from '../hooks/useNotifications.js'
import Header from '../components/Header.js'
import ResultBadge from '../components/ResultBadge.js'
import KeyHints from '../components/KeyHints.js'
import { readSettings } from '../lib/settings.js'
import { formatDate } from '../lib/format.js'

const COUNT_OPTIONS = [5, 10, 25, 50]

export default function ResultsScreen({ taskId, navigate, goBack }) {
  const settings = readSettings()
  const [countIdx, setCountIdx] = useState(0)
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [expanded, setExpanded] = useState(new Set())
  const count = COUNT_OPTIONS[countIdx]

  const { results, loading, refresh } = useResults(taskId, count)
  const { notifications } = useNotifications(10000)

  useInput((input, key) => {
    if (key.escape || input === 'q') { goBack(); return }
    if (key.upArrow || input === 'k') setSelectedIdx(i => Math.max(0, i - 1))
    if (key.downArrow || input === 'j') setSelectedIdx(i => Math.min((results.length || 1) - 1, i + 1))
    if (key.return || input === ' ') {
      setExpanded(s => {
        const next = new Set(s)
        if (next.has(selectedIdx)) next.delete(selectedIdx)
        else next.add(selectedIdx)
        return next
      })
    }
    if (input === '+' || input === ']') setCountIdx(i => Math.min(COUNT_OPTIONS.length - 1, i + 1))
    if (input === '-' || input === '[') setCountIdx(i => Math.max(0, i - 1))
    if (input === 'r') refresh()
    if (input === 'n') navigate('notifications')
    if (input === 's') navigate('settings')
  })

  function duration(r) {
    if (!r.startedAt || !r.completedAt) return ''
    const ms = new Date(r.completedAt) - new Date(r.startedAt)
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(1)}s`
  }

  return React.createElement(
    Box,
    { flexDirection: 'column' },
    React.createElement(Header, {
      title: `Results (last ${count})`,
      notificationCount: notifications.length,
    }),

    loading
      ? React.createElement(Box, { padding: 1 },
          React.createElement(Spinner, { type: 'dots' }),
          React.createElement(Text, null, ' Loading results...'),
        )
      : results.length === 0
      ? React.createElement(Box, { paddingX: 1 },
          React.createElement(Text, { color: 'gray' }, 'No results yet — task hasn\'t run.'),
        )
      : results.map((r, i) => {
          const isSelected = i === selectedIdx
          const isExpanded = expanded.has(i)
          return React.createElement(
            Box,
            { key: r.startedAt, flexDirection: 'column', marginBottom: 0,
              backgroundColor: isSelected ? 'blue' : undefined },
            React.createElement(
              Box,
              { paddingX: 1 },
              React.createElement(Box, { width: 20 },
                React.createElement(Text, { color: isSelected ? 'white' : 'gray' },
                  formatDate(r.completedAt, settings),
                ),
              ),
              React.createElement(Box, { width: 8 },
                React.createElement(ResultBadge, { result: r }),
              ),
              React.createElement(Box, { width: 8 },
                React.createElement(Text, { color: isSelected ? 'white' : 'gray' }, duration(r)),
              ),
              r.attempts > 1
                ? React.createElement(Box, { width: 12 },
                    React.createElement(Text, { color: 'yellow' }, `${r.attempts} attempts`),
                  )
                : null,
              React.createElement(Text, { color: isSelected ? 'cyan' : 'gray' },
                isExpanded ? '▼' : '▶',
              ),
            ),
            isExpanded
              ? React.createElement(
                  Box,
                  { paddingX: 2, borderStyle: 'single', borderColor: 'gray', marginX: 1, flexDirection: 'column' },
                  r.output
                    ? React.createElement(Text, null, r.output)
                    : React.createElement(Text, { color: 'gray' }, '(no output)'),
                  r.error
                    ? React.createElement(Text, { color: 'red' }, 'Error: ' + r.error)
                    : null,
                )
              : null,
          )
        }),

    React.createElement(KeyHints, {
      hints: [
        ['Esc/q', 'back'],
        ['↑↓/jk', 'move'],
        ['↵/Space', 'expand'],
        ['+/-', 'count'],
        ['r', 'refresh'],
      ],
    }),
  )
}
