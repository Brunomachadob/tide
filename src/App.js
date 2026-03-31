import React, { useState, useCallback } from 'react'
import { Box, useInput, useApp } from 'ink'
import { readSettings } from './lib/settings.js'
import TaskListScreen from './screens/TaskListScreen.js'
import TaskDetailScreen from './screens/TaskDetailScreen.js'
import RunsScreen from './screens/RunsScreen.js'
import NotificationsScreen from './screens/NotificationsScreen.js'
import SettingsScreen from './screens/SettingsScreen.js'
import CreateTaskScreen from './screens/CreateTaskScreen.js'


function isFirstRun() {
  return !readSettings().command
}

// Navigation stack: each entry is { screen, props }
export default function App() {
  const { exit } = useApp()
  const [stack, setStack] = useState([{ screen: isFirstRun() ? 'setup' : 'list', props: {} }])

  const navigate = useCallback((screen, props = {}) => {
    setStack(s => [...s, { screen, props }])
  }, [])

  const goBack = useCallback(() => {
    setStack(s => s.length <= 1 ? s : s.slice(0, -1))
  }, [])

  useInput((input, key) => {
    if (key.ctrl && input === 'c') exit()
    if ((input === 'q' || input === 'Q') && stack.length === 1) exit()
  })

  const current = stack[stack.length - 1]
  const screenProps = { navigate, goBack }

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
    case 'create':
      return React.createElement(CreateTaskScreen, { ...screenProps, ...current.props })
    case 'edit':
      return React.createElement(CreateTaskScreen, { ...screenProps, ...current.props })
    default:
      return React.createElement(TaskListScreen, screenProps)
  }
}
