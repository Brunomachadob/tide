import os from 'os'
import path from 'path'

export const TASKS_DIR = path.join(os.homedir(), '.tide', 'tasks')

export function taskDir(id) {
  return path.join(TASKS_DIR, id)
}
