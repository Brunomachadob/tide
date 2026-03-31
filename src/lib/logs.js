// read per-run log files
import fs from 'fs'
import path from 'path'
import { TASKS_DIR } from './tasks.js'

function runLogsDir(taskId, runId) {
  return path.join(TASKS_DIR, taskId, 'runs', runId)
}

function readLastLines(filePath, n) {
  if (!fs.existsSync(filePath)) return null
  const content = fs.readFileSync(filePath, 'utf8')
  if (!content) return ''
  const lines = content.split('\n')
  if (lines[lines.length - 1] === '') lines.pop()
  return lines.slice(-n).join('\n')
}

function countLines(filePath) {
  if (!fs.existsSync(filePath)) return null
  const content = fs.readFileSync(filePath, 'utf8')
  if (!content) return 0
  const lines = content.split('\n')
  if (lines[lines.length - 1] === '') lines.pop()
  return lines.length
}

export function getRunOutputLog(taskId, runId, lines = 50) {
  return readLastLines(path.join(runLogsDir(taskId, runId), 'output.log'), lines)
}

export function getRunStderrLog(taskId, runId, lines = 50) {
  return readLastLines(path.join(runLogsDir(taskId, runId), 'stderr.log'), lines)
}

export function getRunOutputLogLineCount(taskId, runId) {
  return countLines(path.join(runLogsDir(taskId, runId), 'output.log'))
}

export function getRunStderrLogLineCount(taskId, runId) {
  return countLines(path.join(runLogsDir(taskId, runId), 'stderr.log'))
}
