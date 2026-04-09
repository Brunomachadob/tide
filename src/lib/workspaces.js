import os from 'os'
import path from 'path'
import fs from 'fs'
import { safeReadJSON, atomicWriteJSON } from './io.js'
import { TASKS_DIR } from './paths.js'

const WORKSPACES_FILE = path.join(os.homedir(), '.tide', 'workspaces.json')

/** Read all known workspaces. Returns [] if file missing or corrupt. */
export function readWorkspaces() {
  return safeReadJSON(WORKSPACES_FILE, [])
}

/** Add a repo root to workspaces.json if not already present. Idempotent. */
export function addWorkspace(repoRoot) {
  const workspaces = readWorkspaces()
  if (workspaces.some(w => w.path === repoRoot)) return
  atomicWriteJSON(WORKSPACES_FILE, [...workspaces, { path: repoRoot }])
}

/** Remove a repo root from workspaces.json. Best-effort — stale entries are harmless. */
export function removeWorkspace(repoRoot) {
  const workspaces = readWorkspaces().filter(w => w.path !== repoRoot)
  atomicWriteJSON(WORKSPACES_FILE, workspaces)
}

/**
 * One-time migration: scan all existing source.txt files, seed workspaces.json,
 * then delete each source.txt. Idempotent — ENOENT is silently skipped,
 * other errors are logged as warnings (not thrown).
 */
export function migrateSourceTxt() {
  if (!fs.existsSync(TASKS_DIR)) return
  for (const id of fs.readdirSync(TASKS_DIR)) {
    const sourceTxt = path.join(TASKS_DIR, id, 'source.txt')
    try {
      const sourcePath = fs.readFileSync(sourceTxt, 'utf8').trim()
      if (sourcePath) addWorkspace(path.dirname(path.dirname(sourcePath)))
      fs.unlinkSync(sourceTxt)
    } catch (e) {
      if (e.code !== 'ENOENT') console.error(`[tide] warning: could not migrate ${sourceTxt}: ${e.message}`)
    }
  }
}
