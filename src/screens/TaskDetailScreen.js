import React, { useState, useCallback } from 'react'
import { Box, Text, useInput } from 'ink'
import Spinner from 'ink-spinner'
import fs from 'fs'
import path from 'path'
import { spawnSync } from 'child_process'
import { useTask } from '../hooks/useTasks.js'
import { useNotifications } from '../hooks/useNotifications.js'
import Header from '../components/Header.js'
import StatusBadge from '../components/StatusBadge.js'
import ResultBadge from '../components/ResultBadge.js'
import ConfirmDialog from '../components/ConfirmDialog.js'
import Toast from '../components/Toast.js'
import KeyHints from '../components/KeyHints.js'
import RefreshIndicator from '../components/RefreshIndicator.js'
import { readSettings } from '../lib/settings.js'
import { renderMarkdown } from '../lib/markdown.js'
import { formatDate, formatRelativeTime } from '../lib/format.js'
import { bootout, bootstrap, kickstart, plistPath } from '../lib/launchd.js'
import { setEnabled, deleteTask, taskDir } from '../lib/tasks.js'
import { applyPending } from '../lib/taskfile.js'
import { getLatestRun, finalizeAbandonedRun } from '../lib/runs.js'

function Field({ label, value, valueColor }) {
  return React.createElement(
    Box,
    { marginBottom: 0 },
    React.createElement(Box, { width: 20 },
      React.createElement(Text, { color: 'gray' }, label + ':'),
    ),
    React.createElement(Text, { color: valueColor }, String(value ?? '-')),
  )
}

function formatDiffValue(val) {
  if (val === null || val === undefined) return '-'
  if (typeof val === 'object') return JSON.stringify(val)
  return String(val)
}

export default function TaskDetailScreen({ taskId, navigate, goBack, repoRoot, height }) {
  const settings = readSettings()
  const intervalMs = settings.refreshInterval * 1000
  const { task, loading, refresh } = useTask(taskId, intervalMs, repoRoot)
  const { unreadCount } = useNotifications(intervalMs)
  const [confirm, setConfirm] = useState(null)
  const [toast, setToast] = useState(null)

  const showToast = (message, type = 'info') => setToast({ message, type })

  const runAction = useCallback((label, fn, afterNav) => {
    try {
      fn()
      refresh()
      showToast(`${label} done`, 'success')
      if (afterNav) goBack()
    } catch (e) {
      showToast(e.message, 'error')
    }
  }, [refresh, goBack])

  useInput((input, key) => {
    if (confirm) return
    if (key.escape || input === 'q') { goBack(); return }
    if (input === 'k' && task?.status === 'running') setConfirm({ action: 'kill', message: `Kill "${task.name}"? The running process will be terminated.` })
    if (input === 'r') setConfirm({ action: 'run', message: `Run "${task?.name}" now?` })
    if (input === 'e' && task) {
      const action = task.enabled ? 'disable' : 'enable'
      setConfirm({ action, message: `${action === 'enable' ? 'Enable' : 'Disable'} "${task.name}"?` })
    }
    if (key.ctrl && input === 'e' && task?.sourcePath) {
      const editor = process.env.EDITOR || process.env.VISUAL || 'vi'
      spawnSync(editor, [task.sourcePath], { stdio: 'inherit' })
      refresh()
      return
    }
    if (input === 's' && task?.syncStatus) {
      setConfirm({ action: 'sync', message: `Sync "${task?.name}"?` })
      return
    }
    if (input === 'd') {
      const msg = task?.sourcePath
        ? `Delete "${task?.name}"? This will also delete the source file.`
        : `Delete "${task?.name}"? This cannot be undone.`
      setConfirm({ action: 'delete', message: msg })
    }
    if (input === 'l') {
      const latest = getLatestRun(taskId)
      if (latest) navigate('runs', { taskId, taskStatus: task.status, initialRunId: latest.runId })
      else navigate('runs', { taskId, taskStatus: task.status })
    }
    if (input === 'x') navigate('runs', { taskId, taskStatus: task.status })
    if (input === 'n') navigate('notifications')
  })

  const handleConfirm = useCallback(() => {
    const action = confirm.action
    setConfirm(null)
    if (action === 'kill') {
      try {
        const pidFile = `${taskDir(taskId)}/running.pid`
        const pid = parseInt(fs.readFileSync(pidFile, 'utf8').trim())
        process.kill(-pid, 'SIGTERM')
        const run = getLatestRun(taskId)
        if (run && !run.completedAt) {
          const runDir = path.join(taskDir(taskId), 'runs', run.runId)
          finalizeAbandonedRun(taskId, run, runDir)
        }
        refresh()
        showToast(`Killed process ${pid}`, 'success')
      } catch (e) {
        showToast(e.message, 'error')
      }
    }
    else if (action === 'run') {
      try {
        kickstart(taskId)
        showToast(`"${task?.name || taskId}" triggered — running in background`, 'success')
      } catch (e) {
        showToast(e.message, 'error')
      }
    }
    else if (action === 'enable') runAction('Enable', () => { bootstrap(taskId); setEnabled(taskId, true) })
    else if (action === 'disable') runAction('Disable', () => { bootout(taskId); setEnabled(taskId, false) })
    else if (action === 'sync') {
      runAction('Sync', () => {
        applyPending({ type: task.syncStatus, task, existing: task, diff: task.syncDiff || [] })
      })
    }
    else if (action === 'delete') runAction('Delete', () => {
      if (task?.sourcePath && fs.existsSync(task.sourcePath)) fs.unlinkSync(task.sourcePath)
      bootout(taskId)
      const plist = plistPath(taskId)
      if (fs.existsSync(plist)) fs.unlinkSync(plist)
      deleteTask(taskId)
    }, true)
  }, [confirm, taskId, task, runAction])

  if (loading) {
    return React.createElement(Box, { padding: 1 },
      React.createElement(Spinner, { type: 'dots' }),
      React.createElement(Text, null, ' Loading...'),
    )
  }

  if (!task) {
    return React.createElement(Box, { padding: 1 },
      React.createElement(Text, { color: 'red' }, 'Task not found.'),
    )
  }

  const lastRun = formatRelativeTime(task.lastResult?.completedAt)
  const createdAt = formatDate(task.createdAt, settings)
  const sourceBasename = task.sourcePath ? path.basename(task.sourcePath) : null

  // Sync status banner
  function SyncBanner() {
    if (!task.syncStatus) return null
    if (task.syncStatus === 'create') {
      return React.createElement(Box, { marginBottom: 1, paddingX: 1, borderStyle: 'single', borderColor: 'yellow' },
        React.createElement(Text, { color: 'yellow' }, 'Not yet synced — press [s] to register with launchd'),
      )
    }
    if (task.syncStatus === 'orphan') {
      return React.createElement(Box, { marginBottom: 1, paddingX: 1, borderStyle: 'single', borderColor: 'gray' },
        React.createElement(Text, { color: 'gray' }, 'Source file not found — press [s] to remove, or [d] to delete'),
      )
    }
    if (task.syncStatus === 'update' && task.syncDiff?.length > 0) {
      return React.createElement(Box, { marginBottom: 1, flexDirection: 'column', paddingX: 1, borderStyle: 'single', borderColor: 'yellow' },
        React.createElement(Text, { color: 'yellow', bold: true }, 'Pending changes — press [s] to sync:'),
        ...task.syncDiff.map(({ field, from, to }) =>
          React.createElement(Box, { key: field },
            React.createElement(Box, { width: 22 },
              React.createElement(Text, { color: 'gray' }, '  ' + field),
            ),
            React.createElement(Text, { color: 'red' }, formatDiffValue(from)),
            React.createElement(Text, { color: 'gray' }, ' → '),
            React.createElement(Text, { color: 'green' }, formatDiffValue(to)),
          )
        ),
      )
    }
    return null
  }

  return React.createElement(
    Box,
    { flexDirection: 'column', height },
    React.createElement(Header, {
      title: task.name || task.id?.slice(0, 8),
      notificationCount: unreadCount,
    }),

    React.createElement(
      Box,
      { flexDirection: 'column', paddingX: 1 },
      React.createElement(SyncBanner, null),

      React.createElement(Box, { marginBottom: 1, gap: 3, flexDirection: 'column' },
        React.createElement(Box, { gap: 3 },
          React.createElement(Box, null,
            React.createElement(Text, { color: 'gray' }, 'Status: '),
            task.syncStatus === 'create'
              ? React.createElement(Text, { color: 'gray' }, '-')
              : React.createElement(StatusBadge, { status: task.status }),
          ),
          React.createElement(Box, null,
            React.createElement(Text, { color: 'gray' }, 'Last result: '),
            React.createElement(ResultBadge, { result: task.lastResult }),
          ),
        ),
        task.status === 'not loaded' && task.syncStatus !== 'create'
          ? React.createElement(Text, { color: 'yellow' }, "→ press 'e' to re-register with launchd")
          : task.status === 'launchd-error'
          ? React.createElement(Box, { flexDirection: 'column' },
              React.createElement(Text, { color: 'red' }, `→ launchd exit code ${task.launchdExitCode} — task will not run`),
              task.launchdExitCode === 78
                ? React.createElement(Text, { color: 'gray' }, '   EX_CONFIG: plist or runner path is invalid. Press \'e\' to disable and re-enable.')
                : React.createElement(Text, { color: 'gray' }, "   Press 'e' to disable and re-enable, or check ~/Library/LaunchAgents/com.tide." + task.id + '.plist'),
            )
          : null,
      ),
      React.createElement(Field, { label: 'ID',         value: task.id }),
      React.createElement(Field, { label: 'Schedule',   value: task.scheduleLabel }),
      React.createElement(Field, { label: 'Command',    value: task.command }),
      task.extraArgs?.length
        ? React.createElement(Field, { label: 'Extra args', value: task.extraArgs.join(' ') })
        : null,
      React.createElement(Field, { label: 'Working dir', value: task.workingDirectory }),
      React.createElement(Field, { label: 'Max retries', value: task.maxRetries ?? 0 }),
      task.claudeStreamJson
        ? React.createElement(Field, { label: 'Claude stream-json', value: 'enabled', valueColor: 'green' })
        : null,
      sourceBasename
        ? React.createElement(Field, { label: 'Source', value: sourceBasename })
        : null,
      React.createElement(Field, { label: 'Created',    value: createdAt }),
      React.createElement(Field, { label: 'Last run',   value: lastRun }),
      React.createElement(
        Box,
        { marginTop: 1, flexDirection: 'column' },
        React.createElement(Text, { color: 'gray' }, 'Argument:'),
        React.createElement(
          Box,
          { borderStyle: 'single', borderColor: 'gray', paddingX: 1, marginTop: 0 },
          React.createElement(Text, { wrap: 'wrap' }, task.argument ? renderMarkdown(task.argument) : '(empty)'),
        ),
      ),
    ),

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
          React.createElement(Toast, { message: toast.message, type: toast.type, onDone: () => setToast(null) }),
        )
      : null,

    React.createElement(Box, { flexGrow: 1 }),
    React.createElement(KeyHints, {
      hints: [
        ['Esc/q', 'back'],
        ['r', 'run'],
        ...(task.status === 'running' ? [['k', 'kill']] : []),
        ['e', 'en/disable'],
        ...(task.sourcePath ? [['Ctrl+E', 'edit file'], ['s', 'sync']] : [['Ctrl+E', 'edit']]),
        ['l', 'logs'],
        ['x', 'runs'],
        ['d', 'delete'],
      ],
      refreshIndicator: React.createElement(RefreshIndicator, { intervalMs, loading }),
    }),
  )
}
