// read task log files
import fs from 'fs'
import path from 'path'
import os from 'os'

const TASKS_DIR = path.join(os.homedir(), '.tide', 'tasks')

function logsDir(taskId) {
  return path.join(TASKS_DIR, taskId, 'logs')
}

function readLastLines(filePath, n) {
  if (!fs.existsSync(filePath)) return null
  const content = fs.readFileSync(filePath, 'utf8')
  if (!content) return ''
  const lines = content.split('\n')
  if (lines[lines.length - 1] === '') lines.pop()
  return lines.slice(-n).join('\n')
}

export function getOutputLog(taskId, lines = 50) {
  return readLastLines(path.join(logsDir(taskId), 'output.log'), lines)
}

export function getStderrLog(taskId, lines = 50) {
  return readLastLines(path.join(logsDir(taskId), 'stderr.log'), lines)
}

export function getStdoutLog(taskId, lines = 50) {
  return readLastLines(path.join(logsDir(taskId), 'stdout.log'), lines)
}
