import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import os from 'os'
import Header from '../components/Header.js'
import FieldBox from '../components/FieldBox.js'
import TextInput from '../components/TextInput.js'
import Toast from '../components/Toast.js'
import KeyHints from '../components/KeyHints.js'
import { readSettings, writeSettings } from '../lib/settings.js'
import { DATE_FORMATS, TERMINALS } from '../lib/constants.js'

const FIELDS = ['command', 'workingDir', 'dateFormat', 'terminal', 'terminalCustom', 'refreshInterval']

const REFRESH_INTERVALS = [2, 5, 10, 30, 60]

function formatDateExample(fmt) {
  const d = new Date()
  const pad = n => String(n).padStart(2, '0')
  const year = d.getFullYear()
  const month = pad(d.getMonth() + 1)
  const day = pad(d.getDate())
  if (fmt === 'DD.MM.YYYY') return `${day}.${month}.${year}`
  if (fmt === 'MM/DD/YYYY') return `${month}/${day}/${year}`
  return `${year}-${month}-${day}`
}

function PickerOptions({ items, selectedIdx, showExamples }) {
  return React.createElement(
    Box, { gap: 2 },
    items.map((item, i) =>
      React.createElement(Box, { key: item, gap: 1 },
        React.createElement(Text,
          { color: i === selectedIdx ? 'cyan' : 'gray', bold: i === selectedIdx },
          i === selectedIdx ? `[${item}]` : ` ${item} `,
        ),
        showExamples
          ? React.createElement(Text, { color: 'gray' }, `→ ${formatDateExample(item)}`)
          : null,
      ),
    ),
  )
}

const CUSTOM_IDX = TERMINALS.length // index of the synthetic "Custom" option
const TERMINAL_LABELS = [...TERMINALS.map(t => t.label), 'Custom']

function initialTerminalIdx(bundleId) {
  const idx = TERMINALS.findIndex(t => t.bundleId === bundleId)
  return idx === -1 ? CUSTOM_IDX : idx
}

// onSave: optional callback after saving (used for first-run redirect to 'list')
export default function SettingsScreen({ goBack, navigate, onSave, height, breadcrumb }) {
  const saved = readSettings()
  const [field, setField] = useState('command')
  const [command, setCommand] = useState(saved.command || '')
  const [workingDir, setWorkingDir] = useState(saved.defaultWorkingDirectory || os.homedir())
  const [dateFormatIdx, setDateFormatIdx] = useState(Math.max(0, DATE_FORMATS.indexOf(saved.dateFormat)))
  const [terminalIdx, setTerminalIdx] = useState(initialTerminalIdx(saved.terminalBundleId))
  const [customBundleId, setCustomBundleId] = useState(
    initialTerminalIdx(saved.terminalBundleId) === CUSTOM_IDX ? (saved.terminalBundleId || '') : ''
  )
  const [refreshIntervalIdx, setRefreshIntervalIdx] = useState(
    Math.max(0, REFRESH_INTERVALS.indexOf(saved.refreshInterval ?? 5))
  )
  const [toast, setToast] = useState(null)

  const isCustomTerminal = terminalIdx === CUSTOM_IDX
  const resolvedBundleId = isCustomTerminal ? customBundleId.trim() : TERMINALS[terminalIdx].bundleId

  useInput((input, key) => {
    if (toast) return
    if (key.escape || input === 'q') { goBack(); return }

    if (key.tab) {
      const next = FIELDS[(FIELDS.indexOf(field) + 1) % FIELDS.length]
      // skip terminalCustom unless Custom is selected
      if (next === 'terminalCustom' && !isCustomTerminal) {
        setField(FIELDS[(FIELDS.indexOf('terminalCustom') + 1) % FIELDS.length])
      } else {
        setField(next)
      }
      return
    }
    if (field === 'dateFormat') {
      if (key.leftArrow || input === 'h') setDateFormatIdx(i => Math.max(0, i - 1))
      else if (key.rightArrow || input === 'l') setDateFormatIdx(i => Math.min(DATE_FORMATS.length - 1, i + 1))
    }
    if (field === 'terminal') {
      if (key.leftArrow || input === 'h') setTerminalIdx(i => Math.max(0, i - 1))
      else if (key.rightArrow || input === 'l') setTerminalIdx(i => Math.min(CUSTOM_IDX, i + 1))
    }
    if (field === 'refreshInterval') {
      if (key.leftArrow || input === 'h') setRefreshIntervalIdx(i => Math.max(0, i - 1))
      else if (key.rightArrow || input === 'l') setRefreshIntervalIdx(i => Math.min(REFRESH_INTERVALS.length - 1, i + 1))
    }
    if (key.return) {
      writeSettings({
        command: command.trim(),
        defaultWorkingDirectory: workingDir.trim() || os.homedir(),
        dateFormat: DATE_FORMATS[dateFormatIdx],
        terminalBundleId: resolvedBundleId,
        refreshInterval: REFRESH_INTERVALS[refreshIntervalIdx],
      })
      setToast({ message: 'Settings saved', type: 'success' })
      if (onSave) setTimeout(onSave, 1500)
    }
  })

  return React.createElement(
    Box, { flexDirection: 'column', height },
    React.createElement(Header, { breadcrumb }),

    React.createElement(Box, { flexDirection: 'column', paddingX: 1 },
      React.createElement(FieldBox, { label: 'Run command (must end with prompt flag)', active: field === 'command' },
        React.createElement(TextInput, { value: command, onChange: setCommand, active: field === 'command', placeholder: '/opt/homebrew/bin/claude --permission-mode bypassPermissions -p' }),
      ),
      React.createElement(FieldBox, { label: 'Default working directory', active: field === 'workingDir' },
        React.createElement(TextInput, { value: workingDir, onChange: setWorkingDir, active: field === 'workingDir', placeholder: os.homedir() }),
      ),
      React.createElement(FieldBox, { label: 'Date Format', active: field === 'dateFormat' },
        React.createElement(PickerOptions, { items: DATE_FORMATS, selectedIdx: dateFormatIdx, showExamples: true }),
        React.createElement(Text, { color: 'gray' }, 'Use ←→ to change'),
      ),
      React.createElement(FieldBox, { label: 'Terminal app (for notification click)', active: field === 'terminal' },
        React.createElement(PickerOptions, { items: TERMINAL_LABELS, selectedIdx: terminalIdx, showExamples: false }),
        React.createElement(Text, { color: 'gray' }, 'Use ←→ to change'),
      ),
      isCustomTerminal
        ? React.createElement(FieldBox, { label: 'Custom bundle ID', active: field === 'terminalCustom' },
            React.createElement(TextInput, { value: customBundleId, onChange: setCustomBundleId, active: field === 'terminalCustom', placeholder: 'com.example.MyTerminal' }),
          )
        : null,
      React.createElement(FieldBox, { label: 'Auto-refresh interval', active: field === 'refreshInterval' },
        React.createElement(PickerOptions, { items: REFRESH_INTERVALS.map(s => `${s}s`), selectedIdx: refreshIntervalIdx, showExamples: false }),
        React.createElement(Text, { color: 'gray' }, 'Use ←→ to change'),
      ),
    ),

    toast
      ? React.createElement(Box, { marginTop: 1, paddingX: 1 },
          React.createElement(Toast, { message: toast.message, type: toast.type, onDone: () => setToast(null) }),
        )
      : null,

    React.createElement(Box, { flexGrow: 1 }),
    React.createElement(KeyHints, {
      hints: [['Esc/q', 'back'], ['Tab', 'switch field'], ['←→', 'change value'], ['↵', 'save']],
    }),
  )
}
