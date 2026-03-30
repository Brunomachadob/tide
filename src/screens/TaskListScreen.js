import React, { useState, useCallback } from 'react'
import { Box, Text, useInput } from 'ink'
import Spinner from 'ink-spinner'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { useTasks } from '../hooks/useTasks.js'
import { useNotifications } from '../hooks/useNotifications.js'
import Header from '../components/Header.js'
import StatusBadge from '../components/StatusBadge.js'
import ResultBadge from '../components/ResultBadge.js'
import ConfirmDialog from '../components/ConfirmDialog.js'
import Toast from '../components/Toast.js'
import KeyHints from '../components/KeyHints.js'
import { readSettings } from '../lib/settings.js'
import { formatDate, formatRelativeTime } from '../lib/format.js'
import { bootout, bootstrap, kickstart, plistPath } from '../lib/launchd.js'
import { setEnabled, deleteTask } from '../lib/tasks.js'

export default function TaskListScreen({ navigate }) {
  const settings = readSettings()
  const { tasks, loading, error, refresh } = useTasks(5000)
  const { notifications } = useNotifications(10000)
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [confirm, setConfirm] = useState(null) // { action, taskId, message }
  const [toast, setToast] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)

  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type })
  }, [])

  const runAction = useCallback(async (label, fn) => {
    setActionLoading(true)
    try {
      fn()
      refresh()
      showToast(`${label} done`, 'success')
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setActionLoading(false)
    }
  }, [refresh, showToast])

  useInput((input, key) => {
    if (confirm || actionLoading) return

    if (key.upArrow || input === 'k') {
      setSelectedIdx(i => Math.max(0, i - 1))
    } else if (key.downArrow || input === 'j') {
      setSelectedIdx(i => Math.min((tasks.length || 1) - 1, i + 1))
    } else if (key.return) {
      if (tasks[selectedIdx]) navigate('detail', { taskId: tasks[selectedIdx].id })
    } else if (input === 'l') {
      if (tasks[selectedIdx]) navigate('logs', { taskId: tasks[selectedIdx].id })
    } else if (input === 'x') {
      if (tasks[selectedIdx]) navigate('results', { taskId: tasks[selectedIdx].id })
    } else if (input === 'r') {
      if (tasks[selectedIdx]) {
        const t = tasks[selectedIdx]
        setConfirm({ action: 'run', taskId: t.id, message: `Run "${t.name}" now?` })
      }
    } else if (input === 'e') {
      if (tasks[selectedIdx]) {
        const t = tasks[selectedIdx]
        const action = t.enabled ? 'disable' : 'enable'
        setConfirm({ action, taskId: t.id, message: `${action === 'enable' ? 'Enable' : 'Disable'} "${t.name}"?` })
      }
    } else if (input === 'd') {
      if (tasks[selectedIdx]) {
        const t = tasks[selectedIdx]
        setConfirm({ action: 'delete', taskId: t.id, message: `Delete "${t.name}"? This cannot be undone.` })
      }
    } else if (input === 'c') {
      navigate('create')
    } else if (input === 'n') {
      navigate('notifications')
    } else if (input === 's') {
      navigate('settings')
    } else if (input === 'R') {
      refresh()
    }
  })

  const handleConfirm = useCallback(() => {
    const { action, taskId } = confirm
    setConfirm(null)

    if (action === 'run') {
      try {
        kickstart(taskId)
        showToast(`"${tasks.find(t => t.id === taskId)?.name || taskId}" triggered — running in background`, 'success')
      } catch (e) {
        showToast(e.message, 'error')
      }
    } else if (action === 'enable') {
      runAction('Enable', () => { bootstrap(taskId); setEnabled(taskId, true) })
    } else if (action === 'disable') {
      runAction('Disable', () => { bootout(taskId); setEnabled(taskId, false) })
    } else if (action === 'delete') {
      runAction('Delete', () => {
        bootout(taskId)
        const plist = plistPath(taskId)
        if (fs.existsSync(plist)) fs.unlinkSync(plist)
        const promptFile = path.join(os.homedir(), '.tide', 'prompts', `${taskId}.txt`)
        if (fs.existsSync(promptFile)) fs.unlinkSync(promptFile)
        deleteTask(taskId)
        setSelectedIdx(i => Math.max(0, i - 1))
      })
    }
  }, [confirm, runAction])

  if (loading) {
    return React.createElement(Box, { padding: 1 },
      React.createElement(Spinner, { type: 'dots' }),
      React.createElement(Text, null, ' Loading tasks...'),
    )
  }

  const COLS = [
    { label: 'NAME',     width: 22 },
    { label: 'SCHEDULE', width: 18 },
    { label: 'STATUS',   width: 14 },
    { label: 'LAST RUN', width: 17 },
    { label: 'RESULT',   width: 18 },
  ]

  function Sparkline({ results, isSelected }) {
    if (!results || results.length === 0) return React.createElement(Text, { color: 'gray' }, '-')
    const dots = [...results].reverse().map((r, i) => {
      const ok = r.exitCode === 0
      return React.createElement(Text, { key: i, color: ok ? 'green' : 'red' }, ok ? '✓' : '✗')
    })
    return React.createElement(Box, { gap: 0 }, ...dots)
  }

  const pad = (str, w) => {
    const s = String(str || '')
    return s.length > w ? s.slice(0, w - 1) + '…' : s.padEnd(w)
  }

  return React.createElement(
    Box,
    { flexDirection: 'column' },
    React.createElement(Header, {
      title: null,
      notificationCount: notifications.length,
    }),

    error
      ? React.createElement(Text, { color: 'red' }, 'Error: ' + error)
      : null,

    // Column headers
    React.createElement(
      Box,
      { paddingX: 1 },
      ...COLS.map(c =>
        React.createElement(Box, { key: c.label, width: c.width },
          React.createElement(Text, { bold: true, color: 'gray' }, c.label),
        ),
      ),
    ),
    React.createElement(Box, { paddingX: 1 },
      React.createElement(Text, { color: 'gray' }, '─'.repeat(COLS.reduce((s, c) => s + c.width, 0))),
    ),

    // Rows
    tasks.length === 0
      ? React.createElement(Box, { paddingX: 1, paddingY: 1 },
          React.createElement(Text, { color: 'gray' }, 'No scheduled tasks. Run /tide create to add one.'),
        )
      : tasks.map((task, i) => {
          const isSelected = i === selectedIdx
          const lastRun = formatRelativeTime(task.lastResult?.completedAt)
          return React.createElement(
            Box,
            { key: task.id, paddingX: 1, backgroundColor: isSelected ? 'blue' : undefined },
            React.createElement(Box, { width: COLS[0].width },
              React.createElement(Text, { color: isSelected ? 'white' : undefined, bold: isSelected },
                pad(task.name || task.id.slice(0, 8), COLS[0].width),
              ),
            ),
            React.createElement(Box, { width: COLS[1].width },
              React.createElement(Text, { color: isSelected ? 'white' : 'cyan' },
                pad(task.scheduleLabel, COLS[1].width),
              ),
            ),
            React.createElement(Box, { width: COLS[2].width },
              React.createElement(StatusBadge, { status: task.status }),
            ),
            React.createElement(Box, { width: COLS[3].width },
              React.createElement(Text, { color: isSelected ? 'white' : 'gray' },
                pad(lastRun, COLS[3].width),
              ),
            ),
            React.createElement(Box, { width: COLS[4].width },
              React.createElement(Sparkline, { results: task.recentResults, isSelected }),
            ),
          )
        }),

    confirm
      ? React.createElement(Box, { marginTop: 1, paddingX: 1 },
          React.createElement(ConfirmDialog, {
            message: confirm.message,
            onConfirm: handleConfirm,
            onCancel: () => setConfirm(null),
          }),
        )
      : null,

    toast
      ? React.createElement(Box, { marginTop: 1, paddingX: 1 },
          React.createElement(Toast, {
            message: toast.message,
            type: toast.type,
            onDone: () => setToast(null),
          }),
        )
      : null,

    React.createElement(KeyHints, {
      hints: [
        ['↑↓/jk', 'move'],
        ['↵', 'detail'],
        ['c', 'create'],
        ['r', 'run'],
        ['e', 'en/disable'],
        ['l', 'logs'],
        ['x', 'results'],
        ['d', 'delete'],
        ['R', 'refresh'],
        ['q', 'quit'],
      ],
    }),
  )
}
