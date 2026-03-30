import os from 'os'
import path from 'path'
import { safeReadJSON, atomicWriteJSON } from './io.js'

const SETTINGS_FILE = path.join(os.homedir(), '.tide', 'settings.json')

const DEFAULTS = {
  dateFormat: 'YYYY-MM-DD',
  command: '',
  defaultWorkingDirectory: os.homedir(),
}

export function readSettings() {
  return { ...DEFAULTS, ...(safeReadJSON(SETTINGS_FILE) ?? {}) }
}

export function writeSettings(settings) {
  atomicWriteJSON(SETTINGS_FILE, settings)
}
