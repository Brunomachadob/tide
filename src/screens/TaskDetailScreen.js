import React, { useState, useCallback } from 'react'
import { Box, Text, useInput } from 'ink'
import Spinner from 'ink-spinner'
import fs from 'fs'
import { useTask } from '../hooks/useTasks.js'
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

export default function TaskDetailScreen({ taskId, navigate, goBack }) {
  const settings = readSettings()
  const { task, loading, refresh } = useTask(taskId, 5000)
  const { notifications } = useNotifications(10000)
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
    if (input === 'r') setConfirm({ action: 'run', message: `Run "${task?.name}" now?` })
    if (input === 'e' && task) {
      const action = task.enabled ? 'disable' : 'enable'
      setConfirm({ action, message: `${action === 'enable' ? 'Enable' : 'Disable'} "${task.name}"?` })
    }
    if (input === 'd') setConfirm({ action: 'delete', message: `Delete "${task?.name}"? This cannot be undone.` })
    if (input === 'l') navigate('logs', { taskId })
    if (input === 'x') navigate('results', { taskId })
    if (input === 'n') navigate('notifications')
    if (input === 's') navigate('settings')
    if (input === 'R') refresh()
  })

  const handleConfirm = useCallback(() => {
    const action = confirm.action
    setConfirm(null)
    if (action === 'run') {
      try {
        kickstart(taskId)
        showToast(`"${task?.name || taskId}" triggered — running in background`, 'success')
      } catch (e) {
        showToast(e.message, 'error')
      }
    }
    else if (action === 'enable') runAction('Enable', () => { bootstrap(taskId); setEnabled(taskId, true) })
    else if (action === 'disable') runAction('Disable', () => { bootout(taskId); setEnabled(taskId, false) })
    else if (action === 'delete') runAction('Delete', () => {
      bootout(taskId)
      const plist = plistPath(taskId)
      if (fs.existsSync(plist)) fs.unlinkSync(plist)
      deleteTask(taskId)
    }, true)
  }, [confirm, taskId, runAction])

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

  return React.createElement(
    Box,
    { flexDirection: 'column' },
    React.createElement(Header, {
      title: task.name || task.id.slice(0, 8),
      notificationCount: notifications.length,
    }),

    React.createElement(
      Box,
      { flexDirection: 'column', paddingX: 1 },
      React.createElement(Box, { marginBottom: 1, gap: 3, flexDirection: 'column' },
        React.createElement(Box, { gap: 3 },
          React.createElement(Box, null,
            React.createElement(Text, { color: 'gray' }, 'Status: '),
            React.createElement(StatusBadge, { status: task.status }),
          ),
          React.createElement(Box, null,
            React.createElement(Text, { color: 'gray' }, 'Last result: '),
            React.createElement(ResultBadge, { result: task.lastResult }),
          ),
        ),
        task.status === 'not loaded'
          ? React.createElement(Text, { color: 'yellow' }, "→ press 'e' to re-register with launchd")
          : null,
      ),
      React.createElement(Field, { label: 'ID',         value: task.id }),
      React.createElement(Field, { label: 'Schedule',   value: task.scheduleLabel }),
      React.createElement(Field, { label: 'Permission', value: task.permissionMode }),
      React.createElement(Field, { label: 'Command',    value: task.command }),
      task.extraArgs?.length
        ? React.createElement(Field, { label: 'Extra args', value: task.extraArgs.join(' ') })
        : null,
      React.createElement(Field, { label: 'Working dir', value: task.workingDirectory }),
      React.createElement(Field, { label: 'Max retries', value: task.maxRetries ?? 0 }),
      React.createElement(Field, { label: 'Created',    value: createdAt }),
      React.createElement(Field, { label: 'Last run',   value: lastRun }),
      React.createElement(
        Box,
        { marginTop: 1, flexDirection: 'column' },
        React.createElement(Text, { color: 'gray' }, 'Prompt:'),
        React.createElement(
          Box,
          { borderStyle: 'single', borderColor: 'gray', paddingX: 1, marginTop: 0 },
          React.createElement(Text, { wrap: 'wrap' }, task.prompt || '(empty)'),
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

    React.createElement(KeyHints, {
      hints: [
        ['Esc/q', 'back'],
        ['r', 'run'],
        ['e', 'en/disable'],
        ['l', 'logs'],
        ['x', 'results'],
        ['d', 'delete'],
        ['R', 'refresh'],
      ],
    }),
  )
}
