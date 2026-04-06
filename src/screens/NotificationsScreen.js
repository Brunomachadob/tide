import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import Spinner from 'ink-spinner'
import { useNotifications } from '../hooks/useNotifications.js'
import Header from '../components/Header.js'
import ConfirmDialog from '../components/ConfirmDialog.js'
import Toast from '../components/Toast.js'
import KeyHints from '../components/KeyHints.js'
import RefreshIndicator from '../components/RefreshIndicator.js'
import { formatDate } from '../lib/format.js'

export default function NotificationsScreen({ navigate, goBack, height, breadcrumb, settings, intervalMs }) {
  const { notifications, loading, clear, clearRead, dismiss, markRead, markAllRead, unreadCount } = useNotifications(intervalMs)
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [confirmClear, setConfirmClear] = useState(false)
  const [toast, setToast] = useState(null)

  const displayed = [...notifications].reverse()

  useInput((input, key) => {
    if (confirmClear) return
    if (key.escape || input === 'q') { goBack(); return }
    if (key.upArrow || input === 'k') {
      setSelectedIdx(i => Math.max(0, i - 1))
      return
    }
    if (key.downArrow || input === 'j') {
      setSelectedIdx(i => Math.min((displayed.length || 1) - 1, i + 1))
      return
    }
    if (key.return && displayed[selectedIdx]) {
      const n = displayed[selectedIdx]
      markRead(n.taskId, n.completedAt)
      navigate('runs', { taskId: n.taskId, taskStatus: null, initialRunId: n.runId })
      return
    }
    if (input === 'd' && displayed[selectedIdx]) {
      const n = displayed[selectedIdx]
      dismiss(n.taskId, n.completedAt)
      setSelectedIdx(i => Math.max(0, Math.min(i, displayed.length - 2)))
      return
    }
    if (input === 'r' && !key.ctrl && displayed.length > 0) {
      markAllRead()
      setToast({ message: 'All notifications marked as read', type: 'success' })
      return
    }
    if (key.ctrl && input === 'r' && displayed.length > 0) {
      clearRead()
      setSelectedIdx(0)
      setToast({ message: 'Read notifications cleared', type: 'success' })
      return
    }
    if (input === 'c' && displayed.length > 0) setConfirmClear(true)
    if (input === 's') navigate('settings')
  })

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
          React.createElement(Text, null, ' Loading...'),
        )
      : notifications.length === 0
      ? React.createElement(Box, { paddingX: 1, paddingY: 1 },
          React.createElement(Text, { color: 'gray' }, 'No notifications.'),
        )
      : React.createElement(
          Box,
          { flexDirection: 'column', paddingX: 1 },
          displayed.map((n, i) => {
            const isSelected = i === selectedIdx
            return React.createElement(
              Box,
              { key: i, flexDirection: 'column', marginBottom: 1,
                borderStyle: 'single',
                borderColor: isSelected ? 'blue' : (n.exitCode === 0 ? 'green' : 'red'),
                paddingX: 1 },
              React.createElement(
                Box,
                { gap: 2 },
                React.createElement(Text, { bold: true }, n.taskName),
                React.createElement(Text, { color: 'gray' }, formatDate(n.completedAt, settings)),
                n.exitCode === 0
                  ? React.createElement(Text, { color: 'green' }, '✓ ok')
                  : React.createElement(Text, { color: 'red' }, `✗ exit ${n.exitCode}`),
                n.read
                  ? React.createElement(Text, { color: 'gray' }, '● read')
                  : React.createElement(Text, { color: 'yellow' }, '● unread'),
              ),
              n.summary
                ? React.createElement(Text, { color: 'gray' }, n.summary)
                : null,
            )
          }),
        ),

    confirmClear
      ? React.createElement(Box, { marginTop: 1, paddingX: 1 },
          React.createElement(ConfirmDialog, {
            message: 'Clear all notifications?',
            onConfirm: () => {
              setConfirmClear(false)
              clear()
              setToast({ message: 'All notifications cleared', type: 'success' })
            },
            onCancel: () => setConfirmClear(false),
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
        ['↑↓/jk', 'move'],
        ['↵', 'logs + mark read'],
        ['d', 'dismiss'],
        ['r', 'mark all read'],
        ['Ctrl+R', 'clear read'],
        ['c', 'clear all'],
        ['Esc/q', 'back'],
      ],
      refreshIndicator: React.createElement(RefreshIndicator, { intervalMs, loading }),
    }),
  )
}
