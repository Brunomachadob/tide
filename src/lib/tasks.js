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

