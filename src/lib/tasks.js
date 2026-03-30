// per-task JSON storage under ~/.tide/tasks/<id>/
import fs from 'fs'
import os from 'os'
import path from 'path'
import { safeReadJSON, atomicWriteJSON } from './io.js'

const TIDE_DIR = path.join(os.homedir(), '.tide')
export const TASKS_DIR = path.join(TIDE_DIR, 'tasks')

export function taskDir(id) {
  return path.join(TASKS_DIR, id)
}

export function taskFile(id) {
  return path.join(TASKS_DIR, id, 'task.json')
}

function ensureTaskDir(id) {
  fs.mkdirSync(path.join(TASKS_DIR, id, 'logs'), { recursive: true })
  fs.mkdirSync(path.join(TASKS_DIR, id, 'results'), { recursive: true })
}

/** Read a single task by ID. Returns null if not found. */
export function readTask(id) {
  return safeReadJSON(taskFile(id))
}

/** Read all tasks, sorted by createdAt ascending. */
export function readTasks() {
  if (!fs.existsSync(TASKS_DIR)) return { tasks: [] }

  const tasks = fs.readdirSync(TASKS_DIR)
    .map(id => readTask(id))
    .filter(Boolean)
    .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''))

  return { tasks }
}

/** Write (create or replace) a single task's task.json. */
export function writeTask(task) {
  ensureTaskDir(task.id)
  atomicWriteJSON(taskFile(task.id), task)
}

/** Resolve task name or ID → full task object, or null if not found */
export function resolveTask(nameOrId) {
  const needle = nameOrId.toLowerCase()

  const exact = readTask(nameOrId)
  if (exact) return exact

  const { tasks } = readTasks()
  const byPrefix = tasks.find(t => t.id.startsWith(needle))
  if (byPrefix) return byPrefix

  return tasks.find(t => (t.name || '').toLowerCase() === needle) || null
}

/** Resolve to ID string, throws if not found */
export function resolveId(nameOrId) {
  const task = resolveTask(nameOrId)
  if (!task) throw new Error(`No task found matching '${nameOrId}'. Run /tide list to see available tasks.`)
  return task.id
}

export function setEnabled(id, enabled) {
  const task = readTask(id)
  if (!task) throw new Error(`Task ${id} not found`)
  task.enabled = enabled
  writeTask(task)
}

export function deleteTask(id) {
  const dir = taskDir(id)
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

/** Format schedule for display */
export function formatSchedule(schedule) {
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
