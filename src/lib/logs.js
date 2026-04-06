// read per-run log files
import fs from 'fs'
import path from 'path'
import { TASKS_DIR } from './tasks.js'

// Maximum bytes to read from the tail of a file. Log rotation caps files at 5 MB
// (keeping last 2 MB), so 256 KB covers the common case of N ≤ 50 lines comfortably.
const TAIL_BUFFER_SIZE = 256 * 1024

function runLogsDir(taskId, runId) {
  return path.join(TASKS_DIR, taskId, 'runs', runId)
}

/**
 * Read at most `bufferSize` bytes from the end of `filePath` and return as a string.
 * Returns null if the file does not exist, '' if the file is empty.
 */
function readTailBuffer(filePath, bufferSize) {
  if (!fs.existsSync(filePath)) return null
  const stat = fs.statSync(filePath)
  if (stat.size === 0) return ''
  const readSize = Math.min(stat.size, bufferSize)
  const buf = Buffer.allocUnsafe(readSize)
  const fd = fs.openSync(filePath, 'r')
  try {
    fs.readSync(fd, buf, 0, readSize, stat.size - readSize)
  } finally {
    fs.closeSync(fd)
  }
  return buf.toString('utf8')
}

function readLastLines(filePath, n) {
  const tail = readTailBuffer(filePath, TAIL_BUFFER_SIZE)
  if (tail === null) return null
  if (tail === '') return ''
  const lines = tail.split('\n')
  if (lines[lines.length - 1] === '') lines.pop()
  return lines.slice(-n).join('\n')
}

function countLines(filePath) {
  const tail = readTailBuffer(filePath, TAIL_BUFFER_SIZE)
  if (tail === null) return null
  if (tail === '') return 0
  const lines = tail.split('\n')
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

/** Returns the full output log content (no line limit), or null if file absent. */
export function getRunOutputLogFull(taskId, runId) {
  const filePath = path.join(runLogsDir(taskId, runId), 'output.log')
  if (!fs.existsSync(filePath)) return null
  const content = fs.readFileSync(filePath, 'utf8')
  if (!content) return ''
  const lines = content.split('\n')
  if (lines[lines.length - 1] === '') lines.pop()
  return lines.join('\n')
}
