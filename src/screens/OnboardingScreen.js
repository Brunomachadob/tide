import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import fs from 'fs'
import os from 'os'
import path from 'path'
import Header from '../components/Header.js'
import FieldBox from '../components/FieldBox.js'
import Toast from '../components/Toast.js'
import KeyHints from '../components/KeyHints.js'
import useTheme from '../hooks/useTheme.js'
import { readSettings, writeSettings } from '../lib/settings.js'

const AGENTS = [
  { key: 'claude-code', label: 'Claude Code',    authHint: 'claude /login  or  ANTHROPIC_API_KEY' },
  { key: 'copilot',     label: 'GitHub Copilot', authHint: 'gh auth login' },
  { key: 'gemini',      label: 'Gemini CLI',      authHint: 'npx @google/gemini-cli' },
]

function ensureWriteSettings(data) {
  fs.mkdirSync(path.join(os.homedir(), '.tide'), { recursive: true })
  writeSettings(data)
}

export default function OnboardingScreen({ replaceWith, height, breadcrumb }) {
  const { accent } = useTheme()
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [checked, setChecked] = useState(new Set())
  const [toast, setToast] = useState(null)

  function handleConfirm() {
    try {
      const profiles = {}
      for (const key of checked) profiles[key] = { agent: key }
      ensureWriteSettings({ ...readSettings(), profiles })
      replaceWith('list')
    } catch (e) {
      setToast({ message: e.message, type: 'error' })
    }
  }

  function handleSkip() {
    try {
      ensureWriteSettings({ ...readSettings(), profiles: {} })
      replaceWith('list')
    } catch (e) {
      setToast({ message: e.message, type: 'error' })
    }
  }

  useInput((input, key) => {
    if (toast) return
    if (key.upArrow || input === 'k') { setSelectedIdx(i => Math.max(0, i - 1)); return }
    if (key.downArrow || input === 'j') { setSelectedIdx(i => Math.min(AGENTS.length - 1, i + 1)); return }
    if (input === ' ' || key.return) {
      const agentKey = AGENTS[selectedIdx].key
      setChecked(prev => {
        const next = new Set(prev)
        next.has(agentKey) ? next.delete(agentKey) : next.add(agentKey)
        return next
      })
      return
    }
    if (input === 'c') { handleConfirm(); return }
    if (key.escape || input === 'q') { handleSkip(); return }
  })

  return React.createElement(
    Box, { flexDirection: 'column', height },
    React.createElement(Header, { breadcrumb }),

    React.createElement(Box, { flexDirection: 'column', paddingX: 1 },
      React.createElement(Box, { flexDirection: 'column', marginBottom: 1 },
        React.createElement(Text, { color: accent, bold: true }, 'Welcome to Tide'),
        React.createElement(Text, { color: 'gray' }, 'Select the agents you want to use. You can add more later by editing ~/.tide/settings.json.'),
      ),
      AGENTS.map((agent, i) =>
        React.createElement(FieldBox, { key: agent.key, label: agent.label, active: selectedIdx === i },
          React.createElement(Box, { gap: 2 },
            React.createElement(Text, { color: checked.has(agent.key) ? 'green' : 'gray' },
              checked.has(agent.key) ? '[x]' : '[ ]',
            ),
            React.createElement(Text, { color: 'gray', dimColor: true }, `Pre-auth: ${agent.authHint}`),
          ),
        )
      ),
    ),

    toast
      ? React.createElement(Box, { marginTop: 1, paddingX: 1 },
          React.createElement(Toast, { message: toast.message, type: toast.type, onDone: () => setToast(null) }),
        )
      : null,

    React.createElement(Box, { flexGrow: 1 }),
    React.createElement(KeyHints, {
      hints: [['↑↓/jk', 'move'], ['Space/↵', 'toggle'], ['c', 'confirm'], ['Esc/q', 'skip']],
    }),
  )
}
