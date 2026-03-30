import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import os from 'os'
import Header from '../components/Header.js'
import FieldBox from '../components/FieldBox.js'
import TextInput from '../components/TextInput.js'
import Toast from '../components/Toast.js'
import KeyHints from '../components/KeyHints.js'
import { readSettings, writeSettings } from '../lib/settings.js'
import { DATE_FORMATS } from '../lib/constants.js'

const FIELDS = ['command', 'workingDir', 'dateFormat']

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

// onSave: optional callback after saving (used for first-run redirect to 'list')
export default function SettingsScreen({ goBack, navigate, onSave }) {
  const saved = readSettings()
  const [field, setField] = useState('command')
  const [command, setCommand] = useState(saved.command || '')
  const [workingDir, setWorkingDir] = useState(saved.defaultWorkingDirectory || os.homedir())
  const [dateFormatIdx, setDateFormatIdx] = useState(Math.max(0, DATE_FORMATS.indexOf(saved.dateFormat)))
  const [toast, setToast] = useState(null)

  useInput((input, key) => {
    if (toast) return
    if (key.escape || input === 'q') { goBack(); return }

    if (key.tab) {
      setField(f => FIELDS[(FIELDS.indexOf(f) + 1) % FIELDS.length])
      return
    }
    if (field === 'dateFormat') {
      if (key.leftArrow || input === 'h') setDateFormatIdx(i => Math.max(0, i - 1))
      else if (key.rightArrow || input === 'l') setDateFormatIdx(i => Math.min(DATE_FORMATS.length - 1, i + 1))
    }
    if (key.return) {
      writeSettings({
        command: command.trim(),
        defaultWorkingDirectory: workingDir.trim() || os.homedir(),
        dateFormat: DATE_FORMATS[dateFormatIdx],
      })
      setToast({ message: 'Settings saved', type: 'success' })
      if (onSave) setTimeout(onSave, 1500)
    }
  })

  return React.createElement(
    Box, { flexDirection: 'column' },
    React.createElement(Header, { title: 'Settings' }),

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
    ),

    toast
      ? React.createElement(Box, { marginTop: 1, paddingX: 1 },
          React.createElement(Toast, { message: toast.message, type: toast.type, onDone: () => setToast(null) }),
        )
      : null,

    React.createElement(KeyHints, {
      hints: [['Esc/q', 'back'], ['Tab', 'switch field'], ['←→', 'change value'], ['↵', 'save']],
    }),
  )
}
