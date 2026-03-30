import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import os from 'os'
import Header from '../components/Header.js'
import FieldBox from '../components/FieldBox.js'
import TextInput from '../components/TextInput.js'
import Toast from '../components/Toast.js'
import KeyHints from '../components/KeyHints.js'
import { readSettings, writeSettings, detectClaudeCommand } from '../lib/settings.js'
import { DATE_FORMATS, TIMEZONES } from '../lib/constants.js'

const FIELDS = ['command', 'workingDir', 'dateFormat', 'timezone']

function PickerOptions({ items, selectedIdx }) {
  return React.createElement(
    Box, { gap: 2 },
    items.map((item, i) =>
      React.createElement(Box, { key: item },
        React.createElement(Text,
          { color: i === selectedIdx ? 'cyan' : 'gray', bold: i === selectedIdx },
          i === selectedIdx ? `[${item}]` : ` ${item} `,
        ),
      ),
    ),
  )
}

// onSave: optional callback after saving (used for first-run redirect to 'list')
export default function SettingsScreen({ goBack, navigate, onSave }) {
  const saved = readSettings()
  const [field, setField] = useState('command')
  const [command, setCommand] = useState(saved.command || detectClaudeCommand())
  const [workingDir, setWorkingDir] = useState(saved.defaultWorkingDirectory || os.homedir())
  const [dateFormatIdx, setDateFormatIdx] = useState(Math.max(0, DATE_FORMATS.indexOf(saved.dateFormat)))
  const [tzIdx, setTzIdx] = useState(Math.max(0, TIMEZONES.indexOf(saved.timezone)))
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
    if (field === 'timezone') {
      if (key.leftArrow || key.upArrow || input === 'h' || input === 'k') setTzIdx(i => Math.max(0, i - 1))
      else if (key.rightArrow || key.downArrow || input === 'l' || input === 'j') setTzIdx(i => Math.min(TIMEZONES.length - 1, i + 1))
    }
    if (key.return) {
      writeSettings({
        command: command.trim(),
        defaultWorkingDirectory: workingDir.trim() || os.homedir(),
        dateFormat: DATE_FORMATS[dateFormatIdx],
        timezone: TIMEZONES[tzIdx],
      })
      setToast({ message: 'Settings saved', type: 'success' })
      if (onSave) setTimeout(onSave, 1500)
    }
  })

  return React.createElement(
    Box, { flexDirection: 'column' },
    React.createElement(Header, { title: 'Settings' }),

    React.createElement(Box, { flexDirection: 'column', paddingX: 1 },
      React.createElement(FieldBox, { label: 'Claude command', active: field === 'command' },
        React.createElement(TextInput, { value: command, onChange: setCommand, active: field === 'command', placeholder: '/opt/homebrew/bin/claude' }),
      ),
      React.createElement(FieldBox, { label: 'Default working directory', active: field === 'workingDir' },
        React.createElement(TextInput, { value: workingDir, onChange: setWorkingDir, active: field === 'workingDir', placeholder: os.homedir() }),
      ),
      React.createElement(FieldBox, { label: 'Date Format', active: field === 'dateFormat' },
        React.createElement(PickerOptions, { items: DATE_FORMATS, selectedIdx: dateFormatIdx }),
        React.createElement(Text, { color: 'gray' }, 'Use ←→ to change'),
      ),
      React.createElement(FieldBox, { label: 'Timezone', active: field === 'timezone' },
        React.createElement(PickerOptions, { items: TIMEZONES, selectedIdx: tzIdx }),
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
