import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import Header from '../components/Header.js'
import FieldBox from '../components/FieldBox.js'
import Toast from '../components/Toast.js'
import KeyHints from '../components/KeyHints.js'
import useTheme from '../hooks/useTheme.js'
import { readSettings, writeSettings } from '../lib/settings.js'


const REFRESH_INTERVALS = [2, 5, 10, 30, 60]

function PickerOptions({ items, selectedIdx }) {
  const { accent } = useTheme()
  return React.createElement(
    Box, { gap: 2 },
    items.map((item, i) =>
      React.createElement(Text,
        { key: item, color: i === selectedIdx ? accent : 'gray', bold: i === selectedIdx },
        i === selectedIdx ? `[${item}]` : ` ${item} `,
      ),
    ),
  )
}

export default function SettingsScreen({ goBack, _navigate, height, breadcrumb }) {
  const { accent } = useTheme()
  const contentWidth = (process.stdout.columns ?? 80) - 4 // 2 outer paddingX + 2 border
  const saved = readSettings()
  const [field] = useState('refreshInterval')
  const [refreshIntervalIdx, setRefreshIntervalIdx] = useState(
    Math.max(0, REFRESH_INTERVALS.indexOf(saved.refreshInterval ?? 5))
  )
  const [toast, setToast] = useState(null)
  const [scrollOffset, setScrollOffset] = useState(0)

  // header ~2 rows + keyhints ~1 row + borders/padding
  const HEADER_ROWS = 2
  const KEYHINTS_ROWS = 1
  const scrollAreaHeight = (height ?? process.stdout.rows ?? 24) - HEADER_ROWS - KEYHINTS_ROWS

  useInput((input, key) => {
    if (toast) return
    if (key.escape || input === 'q') { goBack(); return }

    if (input === 'j' || key.downArrow) { setScrollOffset(o => o + 1); return }
    if (input === 'k' || key.upArrow) { setScrollOffset(o => Math.max(0, o - 1)); return }

    if (field === 'refreshInterval') {
      if (key.leftArrow || input === 'h') setRefreshIntervalIdx(i => Math.max(0, i - 1))
      else if (key.rightArrow || input === 'l') setRefreshIntervalIdx(i => Math.min(REFRESH_INTERVALS.length - 1, i + 1))
    }
    if (key.return) {
      writeSettings({
        refreshInterval: REFRESH_INTERVALS[refreshIntervalIdx],
      })
      setToast({ message: 'Settings saved', type: 'success' })
    }
  })

  return React.createElement(
    Box, { flexDirection: 'column', height },
    React.createElement(Header, { breadcrumb }),

    React.createElement(Box, { height: scrollAreaHeight, overflowY: 'hidden' },
      React.createElement(Box, { flexDirection: 'column', paddingX: 1, marginTop: -scrollOffset },
        React.createElement(FieldBox, { label: 'Auto-refresh interval', active: field === 'refreshInterval' },
          React.createElement(PickerOptions, { items: REFRESH_INTERVALS.map(s => `${s}s`), selectedIdx: refreshIntervalIdx }),
          React.createElement(Text, { color: 'gray' }, 'Use ←→ to change'),
        ),
        React.createElement(Box, { flexDirection: 'column', borderStyle: 'single', borderColor: 'gray', paddingX: 1, marginBottom: 1, width: contentWidth },
          React.createElement(Text, { color: 'gray' }, 'Profiles'),
          React.createElement(Box, { flexDirection: 'row', flexWrap: 'wrap' },
            ...Object.entries(saved.profiles ?? {}).map(([name, profile]) =>
              React.createElement(Box, { key: name, flexDirection: 'column', borderStyle: 'single', borderColor: 'gray', paddingX: 1, marginBottom: 1, marginRight: 1 },
                React.createElement(Text, { color: accent, bold: true }, name),
                React.createElement(Box, {},
                  React.createElement(Text, { color: 'gray', wrap: 'wrap' }, JSON.stringify(profile, null, 2)),
                ),
              )
            ),
          ),
          React.createElement(Text, { color: 'gray', dimColor: true }, 'read-only — edit ~/.tide/settings.json to change'),
        ),
      ),
    ),

    toast
      ? React.createElement(Box, { marginTop: 1, paddingX: 1 },
          React.createElement(Toast, { message: toast.message, type: toast.type, onDone: () => setToast(null) }),
        )
      : null,

    React.createElement(Box, { flexGrow: 1 }),
    React.createElement(KeyHints, {
      hints: [['Esc/q', 'back'], ['←→', 'change value'], ['↵', 'save'], ['j/k', 'scroll']],
    }),
  )
}
