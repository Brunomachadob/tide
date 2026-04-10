import React, { useState, useCallback } from 'react'
import { useInput, useApp, useStdout } from 'ink'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { readSettings } from './lib/settings.js'
import { findRepoRoot } from './lib/taskfile.js'
import { useTasks } from './hooks/useTasks.js'
import { ThemeContext } from './hooks/useTheme.js'
import TaskListScreen from './screens/TaskListScreen.js'
import TaskDetailScreen from './screens/TaskDetailScreen.js'
import RunsScreen from './screens/RunsScreen.js'
import NotificationsScreen from './screens/NotificationsScreen.js'
import SettingsScreen from './screens/SettingsScreen.js'
import OnboardingScreen from './screens/OnboardingScreen.js'

const WORKSPACE_COLORS = ['cyan', 'magenta', 'blue', 'yellow', 'green']

function workspaceColorFor(workspacePath) {
  if (!workspacePath) return WORKSPACE_COLORS[0]
  let h = 5381
  for (let i = 0; i < workspacePath.length; i++) h = (h * 33) ^ workspacePath.charCodeAt(i)
  return WORKSPACE_COLORS[Math.abs(h) % WORKSPACE_COLORS.length]
}

const SETTINGS_FILE = path.join(os.homedir(), '.tide', 'settings.json')

// Navigation stack: each entry is { screen, props }
export default function App() {
  const { exit } = useApp()
  const { stdout } = useStdout()
  const repoRoot = findRepoRoot(process.cwd())
  const [settings, setSettings] = useState(() => readSettings())
  const intervalMs = settings.refreshInterval * 1000
  const { tasks, loading, error, refresh } = useTasks(intervalMs, repoRoot)
  const [stack, setStack] = useState(() => {
    const isFirstLaunch = !fs.existsSync(SETTINGS_FILE)
    return [{ screen: isFirstLaunch ? 'onboarding' : 'list', props: {} }]
  })
  const [workspaceIdx, setWorkspaceIdx] = useState(0)

  const knownWorkspaces = React.useMemo(() => {
    const roots = new Set()
    for (const t of tasks) {
      if (t.sourcePath) roots.add(path.dirname(path.dirname(t.sourcePath)))
    }
    if (repoRoot) roots.delete(repoRoot)
    return repoRoot ? [repoRoot, ...roots] : [...roots]
  }, [tasks, repoRoot])
  const workspaces = [...knownWorkspaces, null]
  const currentWorkspace = workspaces[workspaceIdx % workspaces.length] ?? null
  const theme = { accent: 'cyan', workspaceColor: workspaceColorFor(currentWorkspace) }

  const navigate = useCallback((screen, props = {}) => {
    setStack(s => [...s, { screen, props }])
  }, [])

  const goBack = useCallback(() => {
    setStack(s => {
      if (s.length <= 1) return s
      const leaving = s[s.length - 1].screen
      if (leaving === 'settings') setSettings(readSettings())
      return s.slice(0, -1)
    })
  }, [])

  const replaceWith = useCallback((screen, props = {}) => {
    setSettings(readSettings())
    setStack([{ screen, props }])
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
      } else if (entry.screen === 'onboarding') {
        parts.push('Welcome')
      } else if (entry.screen === 'detail') {
        const task = tasks?.find(t => t.id === entry.props.taskId)
        parts.push(`${task?.name || entry.props.taskId} (${entry.props.taskId})`)
      } else if (entry.screen === 'runs') {
        // Only push task name if we didn't already get it from a 'detail' entry
        if (!parts.length) {
          const task = tasks?.find(t => t.id === entry.props.taskId)
          parts.push(`${task?.name || entry.props.taskId} (${entry.props.taskId})`)
        }
        parts.push('Runs')
      } else if (entry.screen === 'notifications') {
        parts.push('Notifications')
      } else if (entry.screen === 'settings') {
        parts.push('Settings')
      }
    }
    // If we're inside a run detail (RunsScreen manages that internally), the run id
    // is not tracked in the App stack — RunsScreen passes it via Header directly.
    return parts.length ? parts.join(' › ') : null
  })()

  const screenProps = { navigate, goBack, replaceWith, repoRoot, height: stdout?.rows ? stdout.rows - 1 : undefined, tasks, loading, error, refresh, intervalMs, settings, breadcrumb, workspaceIdx, setWorkspaceIdx, workspaces, currentWorkspace }

  let screen
  switch (current.screen) {
    case 'list':
      screen = React.createElement(TaskListScreen, { ...screenProps, ...current.props }); break
    case 'detail':
      screen = React.createElement(TaskDetailScreen, { ...screenProps, ...current.props }); break
    case 'runs':
      screen = React.createElement(RunsScreen, { ...screenProps, ...current.props }); break
    case 'notifications':
      screen = React.createElement(NotificationsScreen, { ...screenProps, ...current.props }); break
    case 'settings':
      screen = React.createElement(SettingsScreen, { ...screenProps, ...current.props }); break
    case 'onboarding':
      screen = React.createElement(OnboardingScreen, { ...screenProps, ...current.props }); break
    default:
      screen = React.createElement(TaskListScreen, screenProps)
  }

  return React.createElement(ThemeContext.Provider, { value: theme }, screen)
}
