import React, { useState, useEffect } from 'react'
import { Box, Text, useInput } from 'ink'
import Spinner from 'ink-spinner'
import { useRuns } from '../hooks/useRuns.js'
import { useRunLogs } from '../hooks/useLogs.js'
import { renderMarkdown } from '../lib/markdown.js'
import { useNotifications } from '../hooks/useNotifications.js'
import Header from '../components/Header.js'
import ResultBadge from '../components/ResultBadge.js'
import KeyHints from '../components/KeyHints.js'
import { readSettings } from '../lib/settings.js'
import { formatDate, formatRelativeTime } from '../lib/format.js'
import { getRunOutputLogFull } from '../lib/logs.js'
import { readTask } from '../lib/tasks.js'

const COUNT_OPTIONS = [5, 10, 25, 50]
const LINE_OPTIONS = [50, 100, 200, 500]

function duration(run) {
  if (!run.startedAt || !run.completedAt) return ''
  const ms = new Date(run.completedAt) - new Date(run.startedAt)
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function RunDetail({ taskId, taskStatus, run, isLatest, navigate, onBack, height }) {
  const [tab, setTab] = useState('output')
  const [lineIdx, setLineIdx] = useState(0)
  const [autoRefresh, setAutoRefresh] = useState(isLatest && taskStatus === 'running')
  const lines = LINE_OPTIONS[lineIdx]

  const { output, stderr, outputTotal, stderrTotal, loading, refresh } =
    useRunLogs(taskId, run.runId, lines, autoRefresh)
  const { unreadCount } = useNotifications(10000)

  useInput((input, key) => {
    if (key.escape || input === 'q' || key.leftArrow) { onBack(); return }
    if (key.tab || input === '\t') setTab(t => t === 'output' ? 'stderr' : 'output')
    if (key.ctrl && input === 'f') { setAutoRefresh(a => !a); return }
    if (input === 'f') {
      // Follow-up: navigate to create screen pre-seeded with this run's context
      const task = readTask(taskId)
      const prevArgument = run.argument || (task ? task.argument : '') || ''
      const prevOutput = getRunOutputLogFull(taskId, run.runId) || ''
      const prefillArgument = [prevArgument, prevOutput].filter(Boolean).join('\n')
      navigate('create', { prefillArgument, parentRunId: run.runId, defaultsFrom: task })
      return
    }
    if (input === 'r') refresh()
    if (input === 'n') navigate('notifications')
    if (input === 's') navigate('settings')
    if (input === '+' || input === ']') setLineIdx(i => Math.min(LINE_OPTIONS.length - 1, i + 1))
    if (input === '-' || input === '[') setLineIdx(i => Math.max(0, i - 1))
  })

  const content = tab === 'output' ? output : stderr
  const total = tab === 'output' ? outputTotal : stderrTotal
  const truncationHint = total != null && total > lines
    ? `(showing last ${lines} of ${total} lines)`
    : null

  const settings = readSettings()
  const startedAt = formatDate(run.startedAt, settings)
  const dur = duration(run)
  const inProgress = !run.completedAt

  return React.createElement(
    Box,
    { flexDirection: 'column', height },
    React.createElement(Header, {
      title: `Run ${run.runId}`,
      notificationCount: unreadCount,
    }),

    React.createElement(
      Box,
      { paddingX: 1, marginBottom: 1, flexDirection: 'column', gap: 0 },
      React.createElement(
        Box,
        { gap: 3 },
        React.createElement(Text, { color: 'gray' }, startedAt),
        inProgress
          ? React.createElement(Box, { gap: 1 },
              React.createElement(Spinner, { type: 'dots' }),
              React.createElement(Text, { color: 'yellow' }, ' running'),
            )
          : React.createElement(ResultBadge, { result: run }),
        dur ? React.createElement(Text, { color: 'gray' }, dur) : null,
        run.attempts > 1
          ? React.createElement(Text, { color: 'yellow' }, `${run.attempts} attempts`)
          : null,
        run.parentRunId
          ? React.createElement(Text, { color: 'gray' }, `↳ follow-up of ${run.parentRunId}`)
          : null,
      ),
    ),

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
            ? React.createElement(Text, { color: 'gray' }, '(no log yet)')
            : content === ''
            ? React.createElement(Text, { color: 'gray' }, '(empty)')
            : React.createElement(Text, null, tab === 'output' ? renderMarkdown(content) : content),
        ),

    React.createElement(Box, { flexGrow: 1 }),
    React.createElement(KeyHints, {
      hints: [
        ['←/Esc/q', 'back'],
        ['Tab', 'switch tab'],
        ['f', 'follow-up run'],
        ['Ctrl+F', 'toggle follow'],
        ['+/-', 'line count'],
        ['r', 'refresh'],
      ],
    }),
  )
}

export default function RunsScreen({ taskId, taskStatus, initialRunId, navigate, goBack, height }) {
  const settings = readSettings()
  const [view, setView] = useState('list')
  const [countIdx, setCountIdx] = useState(0)
  const [selectedIdx, setSelectedIdx] = useState(0)
  const count = COUNT_OPTIONS[countIdx]

  const { runs, loading, refresh } = useRuns(taskId, count)
  const { unreadCount } = useNotifications(10000)

  useEffect(() => {
    if (!initialRunId || loading || runs.length === 0) return
    const idx = runs.findIndex(r => r.runId === initialRunId)
    if (idx !== -1) {
      setSelectedIdx(idx)
      setView('detail')
    }
  }, [initialRunId, loading, runs])

  const selectedRun = runs[selectedIdx] ?? null

  const openDetail = () => {
    if (selectedRun) setView('detail')
  }

  useInput((input, key) => {
    if (view === 'detail') return  // RunDetail handles its own input

    if (key.escape || input === 'q') { goBack(); return }
    if (key.upArrow || input === 'k') setSelectedIdx(i => Math.max(0, i - 1))
    if (key.downArrow || input === 'j') setSelectedIdx(i => Math.min((runs.length || 1) - 1, i + 1))
    if (key.return || key.rightArrow) openDetail()
    if (input === '+' || input === ']') setCountIdx(i => Math.min(COUNT_OPTIONS.length - 1, i + 1))
    if (input === '-' || input === '[') setCountIdx(i => Math.max(0, i - 1))
    if (input === 'r') refresh()
    if (input === 'n') navigate('notifications')
    if (input === 's') navigate('settings')
  })

  if (view === 'detail' && selectedRun) {
    return React.createElement(RunDetail, {
      taskId,
      taskStatus,
      run: selectedRun,
      isLatest: selectedIdx === 0,
      navigate,
      onBack: () => setView('list'),
      height,
    })
  }

  return React.createElement(
    Box,
    { flexDirection: 'column', height },
    React.createElement(Header, {
      title: `Runs (last ${count})`,
      notificationCount: unreadCount,
    }),

    loading
      ? React.createElement(Box, { padding: 1 },
          React.createElement(Spinner, { type: 'dots' }),
          React.createElement(Text, null, ' Loading runs...'),
        )
      : runs.length === 0
      ? React.createElement(Box, { paddingX: 1 },
          React.createElement(Text, { color: 'gray' }, 'No runs yet — task hasn\'t run.'),
        )
      : runs.map((run, i) => {
          const isSelected = i === selectedIdx
          const inProgress = !run.completedAt
          const dur = duration(run)
          return React.createElement(
            Box,
            { key: run.runId, paddingX: 1, backgroundColor: isSelected ? 'blue' : undefined },
            React.createElement(Box, { width: 22 },
              React.createElement(Text, { color: isSelected ? 'white' : 'gray' },
                formatDate(run.startedAt, settings),
              ),
            ),
            React.createElement(Box, { width: 10 },
              inProgress
                ? React.createElement(Box, { gap: 1 },
                    React.createElement(Spinner, { type: 'dots' }),
                    React.createElement(Text, { color: 'yellow' }, 'running'),
                  )
                : React.createElement(ResultBadge, { result: run }),
            ),
            React.createElement(Box, { width: 8 },
              React.createElement(Text, { color: isSelected ? 'white' : 'gray' }, dur),
            ),
            run.attempts > 1
              ? React.createElement(Box, { width: 12 },
                  React.createElement(Text, { color: 'yellow' }, `${run.attempts} attempts`),
                )
              : null,
            React.createElement(Text, { color: isSelected ? 'cyan' : 'gray' }, '▶'),
          )
        }),

    React.createElement(Box, { flexGrow: 1 }),
    React.createElement(KeyHints, {
      hints: [
        ['Esc/q', 'back'],
        ['↑↓/jk', 'move'],
        ['↵/→', 'open'],
        ['+/-', 'count'],
        ['r', 'refresh'],
      ],
    }),
  )
}
