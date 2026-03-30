// lib/results.js — read task execution result JSON files
'use strict'

const fs = require('fs')
const path = require('path')
const os = require('os')

const TASKS_DIR = path.join(os.homedir(), '.claude', 'scheduler', 'tasks')

function resultsDir(taskId) {
  return path.join(TASKS_DIR, taskId, 'results')
}

/**
 * Returns the last `count` results for a task, most recent first.
 * Returns [] if no results directory or no result files.
 */
function getResults(taskId, count = 5) {
  const dir = resultsDir(taskId)
  if (!fs.existsSync(dir)) return []

  const files = fs.readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .sort() // ISO timestamp filenames sort chronologically

  const recent = files.slice(-count).reverse()

  return recent.map(f => {
    const filePath = path.join(dir, f)
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'))
    } catch (e) {
      return { file: filePath, error: String(e) }
    }
  })
}

/**
 * Returns the single most recent result, or null if none.
 */
function getLatestResult(taskId) {
  const results = getResults(taskId, 1)
  return results.length ? results[0] : null
}

module.exports = { getResults, getLatestResult }
