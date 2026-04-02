import React, { useState, useCallback } from 'react'
import { Box, useInput, useApp, useStdout } from 'ink'
import { readSettings } from './lib/settings.js'
import { findRepoRoot } from './lib/taskfile.js'
import { useTasks } from './hooks/useTasks.js'
import TaskListScreen from './screens/TaskListScreen.js'
import TaskDetailScreen from './screens/TaskDetailScreen.js'
import RunsScreen from './screens/RunsScreen.js'
import NotificationsScreen from './screens/NotificationsScreen.js'
import SettingsScreen from './screens/SettingsScreen.js'

// Navigation stack: each entry is { screen, props }
export default function App() {
  const { exit } = useApp()
  const { stdout } = useStdout()
  const repoRoot = findRepoRoot(process.cwd())
  const [settings, setSettings] = useState(() => readSettings())
  const intervalMs = settings.refreshInterval * 1000
  const { tasks, loading, error, refresh } = useTasks(intervalMs, repoRoot)
  const [stack, setStack] = useState([{ screen: settings.command ? 'list' : 'setup', props: {} }])
  const [scopeIdx, setScopeIdx] = useState(0)

  const navigate = useCallback((screen, props = {}) => {
    setStack(s => [...s, { screen, props }])
  }, [])

  const goBack = useCallback(() => {
    setStack(s => {
      if (s.length <= 1) return s
      const leaving = s[s.length - 1].screen
      if (leaving === 'settings' || leaving === 'setup') setSettings(readSettings())
      return s.slice(0, -1)
    })
  }, [])

  useInput((input, key) => {
    if (key.ctrl && input === 'c') exit()
    if ((input === 'q' || input === 'Q') && stack.length === 1) exit()
  })

  const current = stack[stack.length - 1]

  const breadcrumb = (() => {
    const parts = []
    for (const entry of stack) {
      if (entry.screen === 'list') {
        // no breadcrumb segment for the root list
      } else if (entry.screen === 'detail') {
        const task = tasks?.find(t => t.id === entry.props.taskId)
        parts.push(task?.name || entry.props.taskId)
      } else if (entry.screen === 'runs') {
        // Only push task name if we didn't already get it from a 'detail' entry
        if (!parts.length) {
          const task = tasks?.find(t => t.id === entry.props.taskId)
          parts.push(task?.name || entry.props.taskId)
        }
        parts.push('Runs')
      } else if (entry.screen === 'notifications') {
        parts.push('Notifications')
      } else if (entry.screen === 'settings' || entry.screen === 'setup') {
        parts.push('Settings')
      }
    }
    // If we're inside a run detail (RunsScreen manages that internally), the run id
    // is not tracked in the App stack — RunsScreen passes it via Header directly.
    return parts.length ? parts.join(' › ') : null
  })()

  const screenProps = { navigate, goBack, repoRoot, height: stdout?.rows ? stdout.rows - 1 : undefined, tasks, loading, error, refresh, intervalMs, settings, breadcrumb, scopeIdx, setScopeIdx }

  switch (current.screen) {
    case 'list':
      return React.createElement(TaskListScreen, { ...screenProps, ...current.props })
    case 'detail':
      return React.createElement(TaskDetailScreen, { ...screenProps, ...current.props })
    case 'runs':
      return React.createElement(RunsScreen, { ...screenProps, ...current.props })
    case 'notifications':
      return React.createElement(NotificationsScreen, { ...screenProps, ...current.props })
    case 'settings':
      return React.createElement(SettingsScreen, { ...screenProps, ...current.props })
    case 'setup':
      return React.createElement(SettingsScreen, { ...screenProps, onSave: () => navigate('list'), ...current.props })
    default:
      return React.createElement(TaskListScreen, screenProps)
  }
}
