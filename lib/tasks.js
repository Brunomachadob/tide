// lib/tasks.js — per-task JSON storage under ~/.claude/scheduler/tasks/<id>/
'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')

const SCHEDULER_DIR = path.join(os.homedir(), '.claude', 'scheduler')
const TASKS_DIR = path.join(SCHEDULER_DIR, 'tasks')

function taskDir(id) {
  return path.join(TASKS_DIR, id)
}

function taskFile(id) {
  return path.join(TASKS_DIR, id, 'task.json')
}

function ensureTaskDir(id) {
  fs.mkdirSync(path.join(TASKS_DIR, id, 'logs'), { recursive: true })
  fs.mkdirSync(path.join(TASKS_DIR, id, 'results'), { recursive: true })
}

function ensureNotificationsFile() {
  const notifFile = path.join(SCHEDULER_DIR, 'pending-notifications.json')
  if (!fs.existsSync(notifFile)) {
    fs.writeFileSync(notifFile, '[]')
  }
}

/** Read a single task by ID. Returns null if not found. */
function readTask(id) {
  const file = taskFile(id)
  if (!fs.existsSync(file)) return null
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

/** Read all tasks, sorted by createdAt ascending. */
function readTasks() {
  ensureNotificationsFile()
  if (!fs.existsSync(TASKS_DIR)) return { tasks: [] }

  const tasks = fs.readdirSync(TASKS_DIR)
    .map(id => readTask(id))
    .filter(Boolean)
    .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''))

  return { tasks }
}

/** Write (create or replace) a single task's task.json. */
function writeTask(task) {
  ensureTaskDir(task.id)
  const file = taskFile(task.id)
  const tmp = file + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(task, null, 2))
  fs.renameSync(tmp, file)
}

/** Resolve task name or ID → full task object, or null if not found */
function resolveTask(nameOrId) {
  const needle = nameOrId.toLowerCase()

  // Exact ID match first (fast path)
  const exact = readTask(nameOrId)
  if (exact) return exact

  // Scan all tasks for prefix ID or name match
  const { tasks } = readTasks()

  const byPrefix = tasks.find(t => t.id.startsWith(needle))
  if (byPrefix) return byPrefix

  return tasks.find(t => (t.name || '').toLowerCase() === needle) || null
}

/** Resolve to ID string, throws if not found */
function resolveId(nameOrId) {
  const task = resolveTask(nameOrId)
  if (!task) throw new Error(`No task found matching '${nameOrId}'. Run /scheduler list to see available tasks.`)
  return task.id
}

function setEnabled(id, enabled) {
  const task = readTask(id)
  if (!task) throw new Error(`Task ${id} not found`)
  task.enabled = enabled
  writeTask(task)
}

function deleteTask(id) {
  const dir = taskDir(id)
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

/** Format schedule for display */
function formatSchedule(schedule) {
  if (!schedule) return 'unknown'
  if (schedule.type === 'interval') {
    const secs = schedule.intervalSeconds || schedule.seconds || 3600
    if (secs < 60) return `every ${secs}s`
    if (secs < 3600) return `every ${Math.floor(secs / 60)}m`
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    return `every ${h}h` + (m ? ` ${m}m` : '')
  }
  const hour = schedule.hour ?? 9
  const minute = schedule.minute ?? 0
  const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
  const days = schedule.days || schedule.weekdays
  if (days && days.length) {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    return `${days.map(d => dayNames[d]).join(',')} ${timeStr}`
  }
  return `daily ${timeStr}`
}

module.exports = { taskDir, taskFile, readTask, readTasks, writeTask, resolveTask, resolveId, setEnabled, deleteTask, formatSchedule }
