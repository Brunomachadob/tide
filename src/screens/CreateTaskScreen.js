import React, { useState, useCallback } from 'react'
import { Box, Text, useInput } from 'ink'
import os from 'os'
import Header from '../components/Header.js'
import FieldBox from '../components/FieldBox.js'
import TextInput from '../components/TextInput.js'
import Toast from '../components/Toast.js'
import KeyHints from '../components/KeyHints.js'
import { readSettings } from '../lib/settings.js'
import { createTask } from '../lib/create.js'

const INTERVAL_OPTIONS = [
  { label: '15 min',  seconds: 900 },
  { label: '30 min',  seconds: 1800 },
  { label: '1 hour',  seconds: 3600 },
  { label: '2 hours', seconds: 7200 },
  { label: '6 hours', seconds: 21600 },
  { label: '12 hours',seconds: 43200 },
  { label: '24 hours',seconds: 86400 },
]

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MINUTES = [0, 15, 30, 45]

const STEPS = ['Name', 'Prompt', 'Schedule', 'Working Dir', 'Review']


export default function CreateTaskScreen({ goBack }) {
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [prompt, setPrompt] = useState('')
  const [scheduleMode, setScheduleMode] = useState('interval') // 'interval' | 'calendar'
  const [intervalIdx, setIntervalIdx] = useState(2) // default 1h
  const [hour, setHour] = useState(9)
  const [minuteIdx, setMinuteIdx] = useState(0)
  const [days, setDays] = useState([]) // empty = every day
  const [scheduleField, setScheduleField] = useState('mode') // 'mode'|'value'|'days'
  const [workingDir, setWorkingDir] = useState(() => readSettings().defaultWorkingDirectory || os.homedir())
  const [toast, setToast] = useState(null)
  const [error, setError] = useState(null)

  const nextStep = useCallback(() => setStep(s => Math.min(STEPS.length - 1, s + 1)), [])
  const prevStep = useCallback(() => {
    if (step === 0) goBack()
    else setStep(s => s - 1)
  }, [step, goBack])

  const handleCreate = useCallback(() => {
    try {
      const schedule = scheduleMode === 'interval'
        ? { type: 'interval', intervalSeconds: INTERVAL_OPTIONS[intervalIdx].seconds }
        : { type: 'calendar', hour, minute: MINUTES[minuteIdx], ...(days.length ? { days } : {}) }

      createTask({
        name: name.trim(),
        prompt: prompt.trim(),
        schedule,
        workingDirectory: workingDir.replace(/^~/, os.homedir()),
      })
      setToast({ message: `Task "${name.trim()}" created`, type: 'success' })
      setTimeout(goBack, 1500)
    } catch (e) {
      setError(e.message)
    }
  }, [name, prompt, scheduleMode, intervalIdx, hour, minuteIdx, days, workingDir, goBack])

  useInput((input, key) => {
    if (toast) return

    // Global: Esc goes back a step
    if (key.escape) { prevStep(); return }

    // Step 0: Name
    if (step === 0) {
      if (key.tab && name.trim()) nextStep()
      return
    }

    // Step 1: Prompt
    if (step === 1) {
      if (key.tab && prompt.trim()) nextStep()
      return
    }

    // Step 2: Schedule
    if (step === 2) {
      if (key.tab) {
        if (scheduleMode === 'interval') {
          nextStep()
        } else {
          // cycle through calendar subfields: mode -> value -> days -> next step
          if (scheduleField === 'mode') setScheduleField('value')
          else if (scheduleField === 'value') setScheduleField('days')
          else { nextStep(); setScheduleField('mode') }
        }
        return
      }

      if (scheduleField === 'mode' || (scheduleMode === 'interval')) {
        if (key.leftArrow || input === 'h') setScheduleMode('interval')
        if (key.rightArrow || input === 'l') setScheduleMode('calendar')
      }

      if (scheduleMode === 'interval' && (scheduleField === 'mode' || scheduleField === 'value')) {
        if (key.upArrow || input === 'k') setIntervalIdx(i => Math.max(0, i - 1))
        if (key.downArrow || input === 'j') setIntervalIdx(i => Math.min(INTERVAL_OPTIONS.length - 1, i + 1))
      }

      if (scheduleMode === 'calendar') {
        if (scheduleField === 'value') {
          if (key.upArrow || input === 'k') setHour(h => Math.min(23, h + 1))
          if (key.downArrow || input === 'j') setHour(h => Math.max(0, h - 1))
          if (key.rightArrow || input === 'l') setMinuteIdx(i => Math.min(MINUTES.length - 1, i + 1))
          if (key.leftArrow || input === 'h') setMinuteIdx(i => Math.max(0, i - 1))
        }
        if (scheduleField === 'days') {
          // 0-6 toggles with number keys
          const n = parseInt(input, 10)
          if (!isNaN(n) && n >= 0 && n <= 6) {
            setDays(d => d.includes(n) ? d.filter(x => x !== n) : [...d, n].sort())
          }
        }
      }
      return
    }

    // Step 3: Working dir
    if (step === 3) {
      if (key.tab && workingDir.trim()) nextStep()
      return
    }

    // Step 4: Review
    if (step === 4) {
      if (key.return) handleCreate()
    }
  })

  const stepTitle = `New Task — ${STEPS[step]} (${step + 1}/${STEPS.length})`

  // ── Step renderers ──────────────────────────────────────────────

  function renderStep() {
    if (step === 0) {
      return React.createElement(
        Box, { flexDirection: 'column', paddingX: 1 },
        React.createElement(FieldBox, { label: 'Task name', active: true },
          React.createElement(TextInput, {
            value: name, onChange: setName, active: true,
            placeholder: 'e.g. daily-standup',
          }),
        ),
        !name.trim()
          ? React.createElement(Text, { color: 'gray' }, 'Enter a name, then Tab to continue')
          : React.createElement(Text, { color: 'green' }, 'Tab to continue'),
      )
    }

    if (step === 1) {
      return React.createElement(
        Box, { flexDirection: 'column', paddingX: 1 },
        React.createElement(FieldBox, { label: 'Prompt', active: true },
          React.createElement(
            Box, { height: 6 },
            React.createElement(TextInput, {
              value: prompt, onChange: setPrompt, active: true,
              multiline: true,
              placeholder: 'Describe the task…',
            }),
          ),
        ),
        React.createElement(Text, { color: 'gray' }, 'Enter adds a newline · Tab to continue'),
      )
    }

    if (step === 2) {
      const isInterval = scheduleMode === 'interval'
      return React.createElement(
        Box, { flexDirection: 'column', paddingX: 1 },

        // Mode selector
        React.createElement(FieldBox, { label: 'Schedule type', active: true },
          React.createElement(
            Box, { gap: 4 },
            React.createElement(Text, {
              color: isInterval ? 'cyan' : 'gray', bold: isInterval,
            }, isInterval ? '[interval]' : ' interval '),
            React.createElement(Text, {
              color: !isInterval ? 'cyan' : 'gray', bold: !isInterval,
            }, !isInterval ? '[calendar]' : ' calendar '),
          ),
        ),

        // Interval picker
        isInterval
          ? React.createElement(FieldBox, { label: 'Every', active: true },
              React.createElement(
                Box, { flexDirection: 'column' },
                INTERVAL_OPTIONS.map((opt, i) =>
                  React.createElement(Text, {
                    key: opt.seconds,
                    color: i === intervalIdx ? 'cyan' : 'gray',
                    bold: i === intervalIdx,
                  }, i === intervalIdx ? `▶ ${opt.label}` : `  ${opt.label}`),
                ),
              ),
            )
          : React.createElement(
              Box, { flexDirection: 'column' },
              React.createElement(FieldBox, { label: 'Time (HH:MM)', active: scheduleField === 'value' },
                React.createElement(Text, { color: 'cyan' },
                  `${String(hour).padStart(2, '0')}:${String(MINUTES[minuteIdx]).padStart(2, '0')}`,
                ),
                React.createElement(Text, { color: 'gray' }, '↑↓ hour · ←→ minute'),
              ),
              React.createElement(FieldBox, { label: 'Days (0=Sun…6=Sat, empty=every day)', active: scheduleField === 'days' },
                React.createElement(
                  Box, { gap: 1 },
                  DAY_NAMES.map((d, i) =>
                    React.createElement(Text, {
                      key: d,
                      color: days.includes(i) ? 'cyan' : 'gray',
                      bold: days.includes(i),
                    }, days.includes(i) ? `[${d}]` : ` ${d} `),
                  ),
                ),
                React.createElement(Text, { color: 'gray' }, 'Press 0-6 to toggle days'),
              ),
            ),
      )
    }

    if (step === 3) {
      return React.createElement(
        Box, { flexDirection: 'column', paddingX: 1 },
        React.createElement(FieldBox, { label: 'Working directory', active: true },
          React.createElement(TextInput, {
            value: workingDir, onChange: setWorkingDir, active: true,
          }),
        ),
        React.createElement(Text, { color: 'gray' }, 'Tab to continue'),
      )
    }

    // Step 4: Review
    const schedSummary = scheduleMode === 'interval'
      ? `Every ${INTERVAL_OPTIONS[intervalIdx].label}`
      : `Daily ${String(hour).padStart(2,'0')}:${String(MINUTES[minuteIdx]).padStart(2,'0')}${days.length ? ' on ' + days.map(d => DAY_NAMES[d]).join(',') : ''}`

    return React.createElement(
      Box, { flexDirection: 'column', paddingX: 1 },
      React.createElement(Text, { bold: true, color: 'cyan' }, 'Review'),

      React.createElement(Box, { marginTop: 1, flexDirection: 'column' },
        React.createElement(Box, { gap: 2 },
          React.createElement(Box, { width: 18 }, React.createElement(Text, { color: 'gray' }, 'Name:')),
          React.createElement(Text, null, name),
        ),
        React.createElement(Box, { gap: 2 },
          React.createElement(Box, { width: 18 }, React.createElement(Text, { color: 'gray' }, 'Schedule:')),
          React.createElement(Text, null, schedSummary),
        ),
        React.createElement(Box, { gap: 2 },
          React.createElement(Box, { width: 18 }, React.createElement(Text, { color: 'gray' }, 'Working dir:')),
          React.createElement(Text, null, workingDir),
        ),
        React.createElement(Box, { marginTop: 1, flexDirection: 'column' },
          React.createElement(Text, { color: 'gray' }, 'Prompt:'),
          React.createElement(
            Box, { borderStyle: 'single', borderColor: 'gray', paddingX: 1, marginTop: 0 },
            React.createElement(Text, { wrap: 'wrap' }, prompt),
          ),
        ),
      ),

      error
        ? React.createElement(Text, { color: 'red' }, 'Error: ' + error)
        : React.createElement(Text, { color: 'green' }, 'Press Enter to create task'),
    )
  }

  const keyHints = [
    step < 4
      ? (step === 1
          ? [['↵', 'newline'], ['Tab', 'next'], ['Esc', 'back']]
          : step === 2
            ? [['←→', 'mode'], ['↑↓/0-6', 'value'], ['Tab', 'next'], ['Esc', 'back']]
            : [['Tab', 'next'], ['Esc', 'back']])
      : [['↵', 'create'], ['Esc', 'back']],
  ].flat()

  return React.createElement(
    Box, { flexDirection: 'column' },
    React.createElement(Header, { title: stepTitle }),
    renderStep(),
    toast
      ? React.createElement(Box, { paddingX: 1 },
          React.createElement(Toast, { message: toast.message, type: toast.type, onDone: goBack }),
        )
      : null,
    React.createElement(KeyHints, { hints: keyHints }),
  )
}
