// lib/logs.js — read task log files
'use strict'

const fs = require('fs')
const path = require('path')
const os = require('os')

const TASKS_DIR = path.join(os.homedir(), '.claude', 'scheduler', 'tasks')

function logsDir(taskId) {
  return path.join(TASKS_DIR, taskId, 'logs')
}

function readLastLines(filePath, n) {
  if (!fs.existsSync(filePath)) return null
  const content = fs.readFileSync(filePath, 'utf8')
  if (!content) return ''
  const lines = content.split('\n')
  // If file ends with newline, last element is empty — trim it
  if (lines[lines.length - 1] === '') lines.pop()
  return lines.slice(-n).join('\n')
}

function getOutputLog(taskId, lines = 50) {
  return readLastLines(path.join(logsDir(taskId), 'output.log'), lines)
}

function getStderrLog(taskId, lines = 50) {
  return readLastLines(path.join(logsDir(taskId), 'stderr.log'), lines)
}

function getStdoutLog(taskId, lines = 50) {
  return readLastLines(path.join(logsDir(taskId), 'stdout.log'), lines)
}

module.exports = { getOutputLog, getStderrLog, getStdoutLog }
