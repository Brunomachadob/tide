import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import Spinner from 'ink-spinner'
import { useNotifications } from '../hooks/useNotifications.js'
import Header from '../components/Header.js'
import ConfirmDialog from '../components/ConfirmDialog.js'
import Toast from '../components/Toast.js'
import KeyHints from '../components/KeyHints.js'
import { readSettings } from '../lib/settings.js'
import { formatDate } from '../lib/format.js'

export default function NotificationsScreen({ navigate, goBack }) {
  const settings = readSettings()
  const { notifications, loading, clear, dismiss } = useNotifications(10000)
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
      dismiss(n.taskId)
      setSelectedIdx(i => Math.max(0, Math.min(i, displayed.length - 2)))
      navigate('logs', { taskId: n.taskId })
      return
    }
    if (input === 'd' && displayed[selectedIdx]) {
      const n = displayed[selectedIdx]
      dismiss(n.taskId)
      setSelectedIdx(i => Math.max(0, Math.min(i, displayed.length - 2)))
      return
    }
    if (input === 'c' && displayed.length > 0) setConfirmClear(true)
    if (input === 's') navigate('settings')
  })

  return React.createElement(
    Box,
    { flexDirection: 'column' },
    React.createElement(Header, {
      title: 'Notifications',
      notificationCount: notifications.length,
    }),

    loading
      ? React.createElement(Box, { padding: 1 },
          React.createElement(Spinner, { type: 'dots' }),
          React.createElement(Text, null, ' Loading...'),
        )
      : notifications.length === 0
      ? React.createElement(Box, { paddingX: 1, paddingY: 1 },
          React.createElement(Text, { color: 'gray' }, 'No pending notifications.'),
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
              setToast({ message: 'Notifications cleared', type: 'success' })
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

    React.createElement(KeyHints, {
      hints: [
        ['↑↓/jk', 'move'],
        ['↵', 'logs + dismiss'],
        ['d', 'dismiss'],
        ['c', 'clear all'],
        ['Esc/q', 'back'],
      ],
    }),
  )
}
