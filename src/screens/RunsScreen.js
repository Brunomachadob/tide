import React, { useState, useEffect } from 'react'
import { Box, Text, useInput } from 'ink'
import Spinner from 'ink-spinner'
import path from 'path'
import { spawnSync } from 'child_process'
import { useRuns } from '../hooks/useRuns.js'
import { useRunLogs } from '../hooks/useLogs.js'
import { renderMarkdown } from '../lib/markdown.js'
import { useNotifications } from '../hooks/useNotifications.js'
import Header from '../components/Header.js'
import ResultBadge from '../components/ResultBadge.js'
import KeyHints from '../components/KeyHints.js'
import TextInput from '../components/TextInput.js'
import { readSettings } from '../lib/settings.js'
import { formatDate, formatRelativeTime } from '../lib/format.js'
import { TASKS_DIR } from '../lib/tasks.js'
import { getRunOutputLogFull } from '../lib/logs.js'
import { kickstart } from '../lib/launchd.js'

const VI_FAMILY = new Set(['vi', 'vim', 'nvim', 'view'])

// Tide log lines look like: [2026-04-02T13:39:29Z] [Task Name] [runid] message
const TIDE_LOG_LINE = /^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z\] \[.+?\] \[.+?\] /

const DIM  = '\x1b[2m'
const RESET = '\x1b[0m'

function renderOutput(text) {
  if (!text) return text
  const result = []
  let contentBlock = []

  const flushContent = () => {
    if (contentBlock.length) {
      result.push(renderMarkdown(contentBlock.join('\n')))
      contentBlock = []
    }
  }

  for (const line of text.split('\n')) {
    if (TIDE_LOG_LINE.test(line)) {
      flushContent()
      result.push(`${DIM}${line}${RESET}`)
    } else {
      contentBlock.push(line)
    }
  }
  flushContent()
  return result.join('\n')
}

function openLogReadOnly(filePath) {
  const editor = process.env.EDITOR || process.env.VISUAL || 'vi'
  const bin = path.basename(editor)
  const args = VI_FAMILY.has(bin) ? ['-R', filePath] : [filePath]
  spawnSync(editor, args, { stdio: 'inherit' })
}

const COUNT_OPTIONS = [5, 10, 25, 50]
const LINE_OPTIONS = [50, 100, 200, 500]

function duration(run) {
  if (!run.startedAt || !run.completedAt) return ''
  const ms = new Date(run.completedAt) - new Date(run.startedAt)
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function FollowUpDialog({ taskId, run, onSubmit, onCancel }) {
  const [message, setMessage] = useState('')

  useInput((input, key) => {
    if (key.escape) { onCancel(); return }
    if (key.return) { onSubmit(message); return }
  })

  return React.createElement(
    Box,
    { flexDirection: 'column', borderStyle: 'single', borderColor: 'cyan', paddingX: 1 },
    React.createElement(Text, { bold: true, color: 'cyan' }, 'Follow-up message:'),
    React.createElement(Text, { color: 'gray' }, 'This will be appended after the original argument and run output.'),
    React.createElement(Box, { marginTop: 1 },
      React.createElement(Text, { color: 'gray' }, '> '),
      React.createElement(TextInput, {
        value: message,
        onChange: setMessage,
        active: true,
        placeholder: 'Type your follow-up message...',
      }),
    ),
    React.createElement(Box, { marginTop: 1, gap: 2 },
      React.createElement(Text, { color: 'gray' }, '[Enter] submit'),
      React.createElement(Text, { color: 'gray' }, '[Esc] cancel'),
    ),
  )
}

function RunDetail({ taskId, taskStatus, run, isLatest, navigate, onBack, height, breadcrumb }) {
  const [tab, setTab] = useState('output')
  const [lineIdx, setLineIdx] = useState(0)
  const [autoRefresh, setAutoRefresh] = useState(isLatest && taskStatus === 'running')
  const [followUp, setFollowUp] = useState(false)
  const [toast, setToast] = useState(null)
  const lines = LINE_OPTIONS[lineIdx]

  const { output, stderr, outputTotal, stderrTotal, loading, refresh } =
    useRunLogs(taskId, run.runId, lines, autoRefresh)
  const { unreadCount } = useNotifications(10000)

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(id)
  }, [toast])

  useInput((input, key) => {
    if (followUp) return
    if (key.escape || input === 'q' || key.leftArrow) { onBack(); return }
    if (key.tab || input === '\t') setTab(t => t === 'output' ? 'stderr' : 'output')
    if (key.ctrl && input === 'f') { setAutoRefresh(a => !a); return }
    if (input === 'r') refresh()
    if (input === 'n') navigate('notifications')
    if (input === 's') navigate('settings')
    if (input === '+' || input === ']') setLineIdx(i => Math.min(LINE_OPTIONS.length - 1, i + 1))
    if (input === '-' || input === '[') setLineIdx(i => Math.max(0, i - 1))
    if (input === 'o') {
      const file = tab === 'output' ? 'output.log' : 'stderr.log'
      const filePath = path.join(TASKS_DIR, taskId, 'runs', run.runId, file)
      openLogReadOnly(filePath)
    }
    if (input === 'f' && run.completedAt) {
      setFollowUp(true)
    }
  })

  const handleFollowUpSubmit = (message) => {
    setFollowUp(false)
    const prevArgument = run.argument || ''
    const prevOutput = getRunOutputLogFull(taskId, run.runId) || ''
    const parts = [prevArgument, prevOutput, message].filter(Boolean)
    const overrideArgument = parts.join('\n\n')
    try {
      kickstart(taskId, { overrideArgument, parentRunId: run.runId })
      setToast('Follow-up run triggered')
    } catch (e) {
      setToast(`Error: ${e.message}`)
    }
  }

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
      breadcrumb: `${breadcrumb} › Run ${run.runId}`,
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
            : React.createElement(Text, null, tab === 'output' ? renderOutput(content) : content),
        ),

    followUp
      ? React.createElement(Box, { marginTop: 1, paddingX: 1 },
          React.createElement(FollowUpDialog, {
            taskId,
            run,
            onSubmit: handleFollowUpSubmit,
            onCancel: () => setFollowUp(false),
          }),
        )
      : null,

    toast
      ? React.createElement(Box, { paddingX: 1 },
          React.createElement(Text, { color: 'green' }, toast),
        )
      : null,

    React.createElement(Box, { flexGrow: 1 }),
    React.createElement(KeyHints, {
      hints: [
        ['←/Esc/q', 'back'],
        ['Tab', 'switch tab'],
        ['Ctrl+F', 'toggle follow'],
        ['+/-', 'line count'],
        ['r', 'refresh'],
        ['o', 'open in editor'],
        ...(!inProgress ? [['f', 'follow-up']] : []),
      ],
    }),
  )
}

export default function RunsScreen({ taskId, taskStatus, initialRunId, navigate, goBack, height, breadcrumb }) {
  const settings = readSettings()
  const [view, setView] = useState('list')
  const [countIdx, setCountIdx] = useState(0)
  const [selectedRunId, setSelectedRunId] = useState(null)
  const count = COUNT_OPTIONS[countIdx]

  const { runs, loading, refresh } = useRuns(taskId, count, settings.refreshInterval * 1000)
  const { unreadCount } = useNotifications(10000)

  // Seed selection from initialRunId once runs are loaded
  useEffect(() => {
    if (!initialRunId || loading || runs.length === 0) return
    const found = runs.find(r => r.runId === initialRunId)
    if (found) {
      setSelectedRunId(initialRunId)
      setView('detail')
    }
  }, [initialRunId, loading, runs])

  // Default selection to first run once loaded
  useEffect(() => {
    if (loading || runs.length === 0) return
    setSelectedRunId(id => id ?? runs[0].runId)
  }, [loading, runs])

  const selectedIdx = runs.findIndex(r => r.runId === selectedRunId)
  const effectiveIdx = selectedIdx === -1 ? 0 : selectedIdx
  const selectedRun = runs[effectiveIdx] ?? null

  const openDetail = () => {
    if (selectedRun) setView('detail')
  }

  useInput((input, key) => {
    if (view === 'detail') return  // RunDetail handles its own input

    if (key.escape || input === 'q') { goBack(); return }
    if (key.upArrow || input === 'k') {
      const next = Math.max(0, effectiveIdx - 1)
      if (runs[next]) setSelectedRunId(runs[next].runId)
    }
    if (key.downArrow || input === 'j') {
      const next = Math.min((runs.length || 1) - 1, effectiveIdx + 1)
      if (runs[next]) setSelectedRunId(runs[next].runId)
    }
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
      isLatest: effectiveIdx === 0,
      navigate,
      onBack: () => setView('list'),
      height,
      breadcrumb,
    })
  }

  return React.createElement(
    Box,
    { flexDirection: 'column', height },
    React.createElement(Header, {
      breadcrumb,
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
          const isSelected = i === effectiveIdx
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
