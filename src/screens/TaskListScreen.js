import React, { useState, useCallback } from 'react'
import { Box, Text, useInput } from 'ink'
import Spinner from 'ink-spinner'
import path from 'path'
import { useNotifications } from '../hooks/useNotifications.js'
import useTheme from '../hooks/useTheme.js'
import Header from '../components/Header.js'
import StatusBadge from '../components/StatusBadge.js'
import ResultBadge from '../components/ResultBadge.js'
import ConfirmDialog from '../components/ConfirmDialog.js'
import Toast from '../components/Toast.js'
import KeyHints from '../components/KeyHints.js'
import RefreshIndicator from '../components/RefreshIndicator.js'
import { formatDate, formatRelativeTime } from '../lib/format.js'
import { kickstart } from '../lib/launchd.js'
import { setEnabled, performDeleteTask } from '../lib/tasks.js'
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

export default function TaskListScreen({ navigate, repoRoot, height, tasks, loading, error, refresh, intervalMs, settings, workspaceIdx = 0, setWorkspaceIdx }) {
  const { accent } = useTheme()
  const { unreadCount } = useNotifications(intervalMs)
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [confirm, setConfirm] = useState(null)
  const [toast, setToast] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)

  // Build workspace list from task sourcePaths: unique repo roots, repoRoot first, then null = all
  const knownWorkspaces = React.useMemo(() => {
    const roots = new Set()
    for (const t of tasks) {
      if (t.sourcePath) roots.add(path.dirname(path.dirname(t.sourcePath)))
    }
    if (repoRoot) roots.delete(repoRoot)
    return repoRoot ? [repoRoot, ...roots] : [...roots]
  }, [tasks, repoRoot])
  // workspaces: each known repo root + null (= all)
  const workspaces = [...knownWorkspaces, null]
  const currentWorkspace = workspaces[workspaceIdx % workspaces.length] ?? null

  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type })
  }, [])

  const runAction = useCallback((label, fn) => {
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

  // Filter tasks by current workspace (null = all)
  const visibleTasks = currentWorkspace
    ? tasks.filter(t => t.sourcePath?.startsWith(currentWorkspace))
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
        const action = t.status !== 'disabled' ? 'disable' : 'enable'
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
    } else if (key.tab) {
      setWorkspaceIdx(i => (i + 1) % workspaces.length)
      setSelectedIdx(0)
    } else if (input === 'c') {
      const targetRepo = currentWorkspace || repoRoot
      if (targetRepo) {
        openNewTaskFile(targetRepo)
        refresh()
      } else {
        showToast('No git repo detected', 'error')
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
      runAction('Enable', () => {
        const t = tasks.find(t => t.id === taskId)
        setEnabled(taskId, true, t?.sourcePath)
        if (t) applyPending({ type: 'update', task: t, existing: t, diff: [] })
      })
    } else if (action === 'disable') {
      runAction('Disable', () => { setEnabled(taskId, false) })
    } else if (action === 'delete') {
      runAction('Delete', () => {
        const t = tasks.find(t => t.id === taskId)
        performDeleteTask(taskId, t?.sourcePath)
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

  const showRepo = currentWorkspace === null
  const COLS = [
    { label: 'NAME',         width: 28 },
    { label: 'SCHEDULE',     width: 12 },
    { label: 'STATUS',       width: 20 },
    { label: 'SYNC',         width: 16 },
    { label: 'LAST RUN',     width: 17 },
    { label: 'LAST RESULTS', width: 14 },
  ]
  const totalWidth = COLS.reduce((s, c) => s + c.width, 0)

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

  const workspaceLabel = currentWorkspace ? path.basename(currentWorkspace) : 'all workspaces'

  return React.createElement(
    Box,
    { flexDirection: 'column', height },
    React.createElement(Header, {
      workspaceToggle: workspaces.length > 1 ? { label: workspaceLabel } : null,
      notificationCount: unreadCount,
    }),

    error
      ? React.createElement(Text, { color: 'red' }, 'Error: ' + error)
      : null,

    // Column headers
    React.createElement(
      Box,
      { paddingX: 1 },
      React.createElement(Box, { width: COLS[0].width },
        React.createElement(Text, { bold: true, color: 'gray' }, COLS[0].label),
      ),
      showRepo
        ? React.createElement(Box, { width: 14 },
            React.createElement(Text, { bold: true, color: 'gray' }, 'Repo'),
          )
        : null,
      ...COLS.slice(1).map(c =>
        React.createElement(Box, { key: c.label, width: c.width },
          React.createElement(Text, { bold: true, color: 'gray' }, c.label),
        ),
      ),
    ),
    React.createElement(Box, { paddingX: 1 },
      React.createElement(Text, { color: 'gray' }, '─'.repeat(COLS.reduce((s, c) => s + c.width, 0) + (showRepo ? 14 : 0))),
    ),

    // Rows
    visibleTasks.length === 0
      ? React.createElement(Box, { paddingX: 1, paddingY: 1 },
          React.createElement(Text, { color: 'gray' },
            (currentWorkspace || repoRoot)
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
            showRepo
              ? React.createElement(Box, { width: 14 },
                  React.createElement(Text, { color: isSelected ? 'white' : 'gray' },
                    pad(task.sourcePath ? path.basename(path.dirname(path.dirname(task.sourcePath))) : '-', 14),
                  ),
                )
              : null,
            React.createElement(Box, { width: 12 },
              React.createElement(Text, { color: isSelected ? 'white' : accent },
                pad(task.scheduleLabel, 12),
              ),
            ),
            React.createElement(Box, { width: 20 },
              task.syncStatus === 'create'
                ? React.createElement(Text, { color: 'gray' }, pad('-', 20))
                : React.createElement(StatusBadge, { status: task.status }),
            ),
            React.createElement(Box, { width: 16 },
              React.createElement(SyncBadge, { syncStatus: task.syncStatus }),
            ),
            React.createElement(Box, { width: 17 },
              task.syncStatus === 'create'
                ? React.createElement(Text, { color: 'gray' }, '-')
                : React.createElement(Text, { color: isSelected ? 'white' : 'gray' }, pad(lastRun, 17)),
            ),
            React.createElement(Box, { width: 14 },
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
        ['Ctrl+S', 'sync'],
        ['S', 'sync all'],
        ['r', 'run'],
        ['e', 'en/disable'],
        ['l', 'latest run'],
        ['x', 'runs'],
        ['d', 'delete'],
      ],
      refreshIndicator: React.createElement(RefreshIndicator, { intervalMs, loading }),
    }),
  )
}
