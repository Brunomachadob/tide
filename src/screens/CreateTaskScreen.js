import React, { useState, useCallback } from 'react'
import { Box, Text, useInput } from 'ink'
import os from 'os'
import fs from 'fs'
import path from 'path'
import { spawnSync } from 'child_process'
import Header from '../components/Header.js'
import FieldBox from '../components/FieldBox.js'
import TextInput from '../components/TextInput.js'
import Toast from '../components/Toast.js'
import KeyHints from '../components/KeyHints.js'
import { readSettings } from '../lib/settings.js'
import { createTask, updateTask } from '../lib/create.js'

const INTERVAL_OPTIONS = [
  { label: 'Manual only', manual: true },
  { label: '15 min',  seconds: 900 },
  { label: '30 min',  seconds: 1800 },
  { label: '1 hour',  seconds: 3600 },
  { label: '2 hours', seconds: 7200 },
  { label: '6 hours', seconds: 21600 },
  { label: '12 hours',seconds: 43200 },
  { label: '24 hours',seconds: 86400 },
]

const STEPS = ['Name', 'Argument', 'Schedule', 'Working Dir', 'Command', 'Claude Stream JSON', 'Review']

function intervalIdxForSchedule(schedule) {
  if (!schedule || schedule.type === 'manual') return 0
  const idx = INTERVAL_OPTIONS.findIndex(o => o.seconds === schedule.intervalSeconds)
  return idx >= 0 ? idx : 4  // default to 1h (index 4 after prepending Manual)
}

function openInEditor(current) {
  const editor = process.env.EDITOR || '/usr/bin/vi'
  const tmp = path.join(os.tmpdir(), `tide-argument-${Date.now()}.md`)
  try {
    fs.writeFileSync(tmp, current)
    spawnSync(editor, [tmp], { stdio: 'inherit' })
    return fs.readFileSync(tmp, 'utf8')
  } finally {
    try { fs.unlinkSync(tmp) } catch { /* ok */ }
  }
}

export default function CreateTaskScreen({ task: existingTask, goBack }) {
  const isEdit = !!existingTask
  const [step, setStep] = useState(0)
  const [name, setName] = useState(existingTask?.name ?? '')
  const [argument, setArgument] = useState(existingTask?.argument ?? '')
  const [intervalIdx, setIntervalIdx] = useState(
    existingTask ? intervalIdxForSchedule(existingTask.schedule) : 4
  )
  const [workingDir, setWorkingDir] = useState(
    existingTask?.workingDirectory ?? readSettings().defaultWorkingDirectory ?? os.homedir()
  )
  const [command, setCommand] = useState(
    existingTask?.command ?? readSettings().command ?? ''
  )
  const [claudeStreamJson, setStreamOutput] = useState(existingTask?.claudeStreamJson ?? false)
  const [toast, setToast] = useState(null)
  const [error, setError] = useState(null)

  const nextStep = useCallback(() => setStep(s => Math.min(STEPS.length - 1, s + 1)), [])
  const prevStep = useCallback(() => {
    if (step === 0) goBack()
    else setStep(s => s - 1)
  }, [step, goBack])

  const handleSave = useCallback(() => {
    try {
      const opt = INTERVAL_OPTIONS[intervalIdx]
      const schedule = opt.manual
        ? { type: 'manual' }
        : { type: 'interval', intervalSeconds: opt.seconds }
      const resolvedDir = workingDir.replace(/^~/, os.homedir())
      if (isEdit) {
        updateTask(existingTask, { name: name.trim(), argument: argument.trim(), schedule, workingDirectory: resolvedDir, command: command.trim(), claudeStreamJson })
        setToast({ message: `Task "${name.trim()}" updated`, type: 'success' })
      } else {
        createTask({ name: name.trim(), argument: argument.trim(), schedule, workingDirectory: resolvedDir, command: command.trim(), claudeStreamJson })
        setToast({ message: `Task "${name.trim()}" created`, type: 'success' })
      }
      setTimeout(goBack, 1500)
    } catch (e) {
      setError(e.message)
    }
  }, [isEdit, existingTask, name, argument, intervalIdx, workingDir, command, claudeStreamJson, goBack])

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
      if (key.ctrl && input === 'e') { setArgument(openInEditor(argument)); return }
      if (key.tab && argument.trim()) nextStep()
      return
    }

    // Step 2: Schedule
    if (step === 2) {
      if (key.tab) { nextStep(); return }
      if (key.upArrow || input === 'k') setIntervalIdx(i => Math.max(0, i - 1))
      if (key.downArrow || input === 'j') setIntervalIdx(i => Math.min(INTERVAL_OPTIONS.length - 1, i + 1))
      return
    }

    // Step 3: Working dir
    if (step === 3) {
      if (key.tab && workingDir.trim()) nextStep()
      return
    }

    // Step 4: Command
    if (step === 4) {
      if (key.tab && command.trim()) nextStep()
      return
    }

    // Step 5: Stream Output
    if (step === 5) {
      if (key.tab) { nextStep(); return }
      if (input === ' ' || key.return) setStreamOutput(v => !v)
      return
    }

    // Step 6: Review
    if (step === 6) {
      if (key.return) handleSave()
    }
  })

  const stepTitle = `${isEdit ? 'Edit Task' : 'New Task'} — ${STEPS[step]} (${step + 1}/${STEPS.length})`

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
        React.createElement(FieldBox, { label: 'Argument', active: true },
          React.createElement(
            Box, { height: 6 },
            React.createElement(TextInput, {
              value: argument, onChange: setArgument, active: true,
              multiline: true,
              placeholder: 'Describe the task…',
            }),
          ),
        ),
        React.createElement(Text, { color: 'gray' }, 'Enter adds a newline · Ctrl+E open in $EDITOR · Tab to continue'),
      )
    }

    if (step === 2) {
      return React.createElement(
        Box, { flexDirection: 'column', paddingX: 1 },
        React.createElement(FieldBox, { label: 'Every', active: true },
          React.createElement(
            Box, { flexDirection: 'column' },
            INTERVAL_OPTIONS.map((opt, i) =>
              React.createElement(Text, {
                key: opt.manual ? 'manual' : opt.seconds,
                color: i === intervalIdx ? 'cyan' : 'gray',
                bold: i === intervalIdx,
              }, i === intervalIdx ? `▶ ${opt.label}` : `  ${opt.label}`),
            ),
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

    if (step === 4) {
      return React.createElement(
        Box, { flexDirection: 'column', paddingX: 1 },
        React.createElement(FieldBox, { label: 'Command', active: true },
          React.createElement(TextInput, {
            value: command, onChange: setCommand, active: true,
            placeholder: '/opt/homebrew/bin/claude --permission-mode bypassPermissions -p',
          }),
        ),
        React.createElement(Text, { color: 'gray' }, 'Tab to continue'),
      )
    }

    if (step === 5) {
      return React.createElement(
        Box, { flexDirection: 'column', paddingX: 1 },
        React.createElement(FieldBox, { label: 'Claude stream-json', active: true },
          React.createElement(Text, { color: claudeStreamJson ? 'green' : 'gray' },
            claudeStreamJson ? '[x] Enabled' : '[ ] Disabled',
          ),
        ),
        React.createElement(Text, { color: 'gray' },
          'Enable for Claude commands using --output-format=stream-json --include-partial-messages --verbose.',
        ),
        React.createElement(Text, { color: 'gray' }, 'Space/Enter to toggle · Tab to continue'),
      )
    }

    // Step 6: Review
    const schedOpt = INTERVAL_OPTIONS[intervalIdx]
    const schedSummary = schedOpt.manual ? 'Manual only' : `Every ${schedOpt.label}`

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
        React.createElement(Box, { gap: 2 },
          React.createElement(Box, { width: 18 }, React.createElement(Text, { color: 'gray' }, 'Command:')),
          React.createElement(Text, null, command),
        ),
        React.createElement(Box, { gap: 2 },
          React.createElement(Box, { width: 18 }, React.createElement(Text, { color: 'gray' }, 'Claude stream-json:')),
          React.createElement(Text, null, claudeStreamJson ? 'yes' : 'no'),
        ),
        React.createElement(Box, { marginTop: 1, flexDirection: 'column' },
          React.createElement(Text, { color: 'gray' }, 'Argument:'),
          React.createElement(
            Box, { borderStyle: 'single', borderColor: 'gray', paddingX: 1, marginTop: 0 },
            React.createElement(Text, { wrap: 'wrap' }, argument),
          ),
        ),
      ),

      error
        ? React.createElement(Text, { color: 'red' }, 'Error: ' + error)
        : React.createElement(Text, { color: 'green' }, `Press Enter to ${isEdit ? 'save changes' : 'create task'}`),
    )
  }

  const keyHints = [
    step < 6
      ? (step === 1
          ? [['↵', 'newline'], ['Tab', 'next'], ['Esc', 'back']]
          : step === 2
            ? [['↑↓', 'select'], ['Tab', 'next'], ['Esc', 'back']]
            : step === 5
              ? [['Space', 'toggle'], ['Tab', 'next'], ['Esc', 'back']]
              : [['Tab', 'next'], ['Esc', 'back']])
      : [['↵', isEdit ? 'save' : 'create'], ['Esc', 'back']],
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
