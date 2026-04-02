import React, { useState, useCallback } from 'react'
import { Box, Text, useInput } from 'ink'
import Spinner from 'ink-spinner'
import fs from 'fs'
import path from 'path'
import { useNotifications } from '../hooks/useNotifications.js'
import Header from '../components/Header.js'
import StatusBadge from '../components/StatusBadge.js'
import ResultBadge from '../components/ResultBadge.js'
import ConfirmDialog from '../components/ConfirmDialog.js'
import Toast from '../components/Toast.js'
import KeyHints from '../components/KeyHints.js'
import RefreshIndicator from '../components/RefreshIndicator.js'
import { formatDate, formatRelativeTime } from '../lib/format.js'
import { bootout, kickstart, plistPath } from '../lib/launchd.js'
import { setEnabled, deleteTask } from '../lib/tasks.js'
import { applyPending } from '../lib/taskfile.js'
import { openNewTaskFile } from '../lib/newtask.js'
import { getLatestRun } from '../lib/runs.js'

function SyncBadge({ syncStatus }) {
  if (!syncStatus) return null
  const map = {
    create:  ['yellow',  '● pending create'],
    update:  ['yellow',  '● pending update'],
    orphan:  ['gray',    '○ orphaned'],
  }
  const [color, label] = map[syncStatus] || ['white', syncStatus]
  return React.createElement(Text, { color }, label)
}

export default function TaskListScreen({ navigate, repoRoot, height, tasks, loading, error, refresh, intervalMs, settings }) {
  const { unreadCount } = useNotifications(intervalMs)
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [namespaceFilter, setNamespaceFilter] = useState('current') // 'current' | 'all'
  const [confirm, setConfirm] = useState(null)
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

  // Filter tasks by namespace
  const visibleTasks = (namespaceFilter === 'current' && repoRoot)
    ? tasks.filter(t => t.sourcePath?.startsWith(repoRoot))
    : tasks

  // Pending tasks for [S] sync-all
  const pendingTasks = visibleTasks.filter(t => t.syncStatus)

  useInput((input, key) => {
    if (confirm || actionLoading) return

    if (key.upArrow || input === 'k') {
      setSelectedIdx(i => Math.max(0, i - 1))
    } else if (key.downArrow || input === 'j') {
      setSelectedIdx(i => Math.min((visibleTasks.length || 1) - 1, i + 1))
    } else if (key.return) {
      const t = visibleTasks[selectedIdx]
      if (t && t.id) navigate('detail', { taskId: t.id })
    } else if (input === 'l') {
      const t = visibleTasks[selectedIdx]
      if (t && t.id) {
        const latest = getLatestRun(t.id)
        if (latest) navigate('runs', { taskId: t.id, taskStatus: t.status, initialRunId: latest.runId })
        else navigate('runs', { taskId: t.id, taskStatus: t.status })
      }
    } else if (input === 'x') {
      const t = visibleTasks[selectedIdx]
      if (t && t.id) navigate('runs', { taskId: t.id, taskStatus: t.status })
    } else if (input === 'r') {
      const t = visibleTasks[selectedIdx]
      if (t && t.id) setConfirm({ action: 'run', taskId: t.id, message: `Run "${t.name}" now?` })
    } else if (input === 'e') {
      const t = visibleTasks[selectedIdx]
      if (t && t.id) {
        const action = t.enabled ? 'disable' : 'enable'
        setConfirm({ action, taskId: t.id, message: `${action === 'enable' ? 'Enable' : 'Disable'} "${t.name}"?` })
      }
    } else if (input === 'd') {
      const t = visibleTasks[selectedIdx]
      if (t && t.id) {
        const msg = t.sourcePath
          ? `Delete "${t.name}"? This will also delete the source file.`
          : `Delete "${t.name}"? This cannot be undone.`
        setConfirm({ action: 'delete', taskId: t.id, message: msg })
      }
    } else if (key.ctrl && input === 's') {
      // Sync selected task if it has a pending syncStatus
      const t = visibleTasks[selectedIdx]
      if (t && t.syncStatus) {
        setConfirm({ action: 'sync-one', taskId: t.id, message: `Sync "${t.name}"?` })
      }
    } else if (!key.ctrl && input === 's') {
      navigate('settings')
    } else if (input === 'S') {
      // Sync all pending
      if (pendingTasks.length > 0) {
        setConfirm({ action: 'sync-all', message: `Apply all ${pendingTasks.length} pending change(s)?` })
      }
    } else if (input === 'f') {
      setNamespaceFilter(f => f === 'current' ? 'all' : 'current')
      setSelectedIdx(0)
    } else if (input === 'c') {
      if (repoRoot) {
        openNewTaskFile(repoRoot)
        refresh()
      } else {
        showToast('No git repo detected in current directory', 'error')
      }
    } else if (input === 'n') {
      navigate('notifications')
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
      runAction('Enable', () => { setEnabled(taskId, true) })
    } else if (action === 'disable') {
      runAction('Disable', () => { setEnabled(taskId, false) })
    } else if (action === 'delete') {
      runAction('Delete', () => {
        const t = tasks.find(t => t.id === taskId)
        if (t?.sourcePath && fs.existsSync(t.sourcePath)) fs.unlinkSync(t.sourcePath)
        bootout(taskId)
        const plist = plistPath(taskId)
        if (fs.existsSync(plist)) fs.unlinkSync(plist)
        deleteTask(taskId)
        setSelectedIdx(i => Math.max(0, i - 1))
      })
    } else if (action === 'sync-one') {
      runAction('Sync', () => {
        const t = tasks.find(t => t.id === taskId)
        if (t?.syncStatus) applyPending({ type: t.syncStatus, task: t, existing: t, diff: t.syncDiff })
      })
    } else if (action === 'sync-all') {
      runAction('Sync all', () => {
        for (const t of pendingTasks) {
          applyPending({ type: t.syncStatus, task: t, existing: t, diff: t.syncDiff })
        }
      })
    }
  }, [confirm, tasks, pendingTasks, runAction, showToast])

  if (loading) {
    return React.createElement(Box, { padding: 1 },
      React.createElement(Spinner, { type: 'dots' }),
      React.createElement(Text, null, ' Loading tasks...'),
    )
  }

  const COLS = [
    { label: 'NAME',         width: 28 },
    { label: 'SCHEDULE',     width: 12 },
    { label: 'STATUS',       width: 20 },
    { label: 'SYNC',         width: 16 },
    { label: 'LAST RUN',     width: 17 },
    { label: 'LAST RESULTS', width: 14 },
  ]

  function Sparkline({ results }) {
    if (!results || results.length === 0) return React.createElement(Text, { color: 'gray' }, '-')
    const dots = [...results].reverse().flatMap((r, i) => {
      if (!r.completedAt) return [React.createElement(Spinner, { key: i, type: 'dots' })]
      const ok = r.exitCode === 0
      return [React.createElement(Text, { key: i, color: ok ? 'green' : 'red' }, ok ? '✓' : '✗')]
    })
    return React.createElement(Box, { gap: 0 }, ...dots)
  }

  const pad = (str, w) => {
    const s = String(str || '')
    return s.length > w ? s.slice(0, w - 1) + '…' : s.padEnd(w)
  }

  const subtitle = repoRoot
    ? (namespaceFilter === 'current' ? path.basename(repoRoot) : 'all repos')
    : null

  return React.createElement(
    Box,
    { flexDirection: 'column', height },
    React.createElement(Header, {
      subtitle,
      notificationCount: unreadCount,
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
    visibleTasks.length === 0
      ? React.createElement(Box, { paddingX: 1, paddingY: 1 },
          React.createElement(Text, { color: 'gray' },
            repoRoot
              ? 'No tasks found. Press [c] to create a new task file.'
              : 'No scheduled tasks. Open tide from a git repository to create tasks.',
          ),
        )
      : visibleTasks.map((task, i) => {
          const isSelected = i === selectedIdx
          const lastRun = formatRelativeTime(task.lastResult?.completedAt)
          return React.createElement(
            Box,
            { key: task.id || i, paddingX: 1, backgroundColor: isSelected ? 'blue' : undefined },
            React.createElement(Box, { width: COLS[0].width },
              React.createElement(Text, { color: isSelected ? 'white' : undefined, bold: isSelected },
                pad(task.name || task.id?.slice(0, 8), COLS[0].width),
              ),
            ),
            React.createElement(Box, { width: COLS[1].width },
              React.createElement(Text, { color: isSelected ? 'white' : 'cyan' },
                pad(task.scheduleLabel, COLS[1].width),
              ),
            ),
            React.createElement(Box, { width: COLS[2].width },
              task.syncStatus === 'create'
                ? React.createElement(Text, { color: 'gray' }, pad('-', COLS[2].width))
                : React.createElement(StatusBadge, { status: task.status }),
            ),
            React.createElement(Box, { width: COLS[3].width },
              React.createElement(SyncBadge, { syncStatus: task.syncStatus }),
            ),
            React.createElement(Box, { width: COLS[4].width },
              task.syncStatus === 'create'
                ? React.createElement(Text, { color: 'gray' }, '-')
                : React.createElement(Text, { color: isSelected ? 'white' : 'gray' }, pad(lastRun, COLS[4].width)),
            ),
            React.createElement(Box, { width: COLS[5].width },
              task.syncStatus === 'create'
                ? null
                : React.createElement(Sparkline, { results: task.recentResults }),
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

    React.createElement(Box, { flexGrow: 1 }),
    React.createElement(KeyHints, {
      hints: [
        ['↑↓/jk', 'move'],
        ['↵', 'detail'],
        ['c', 'new file'],
        ['s', 'settings'],
        ['Ctrl+S', 'sync'],
        ['S', 'sync all'],
        ['f', namespaceFilter === 'current' ? 'show all' : 'filter repo'],
        ['r', 'run'],
        ['e', 'en/disable'],
        ['l', 'logs'],
        ['d', 'delete'],
        ['q', 'quit'],
      ],
      refreshIndicator: React.createElement(RefreshIndicator, { intervalMs, loading }),
    }),
  )
}
