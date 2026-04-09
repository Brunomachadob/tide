// Shared .md frontmatter read/write helpers.
// Extracted here to break the tasks.js ↔ taskfile.js circular dependency.
import fs from 'fs'
import path from 'path'
import os from 'os'
import matter from 'gray-matter'
import { readSettings } from './settings.js'
import { parseSchedule } from './constants.js'

/**
 * Parse a .md task file. Returns a task-shaped object with all defaults applied.
 *
 * When includeExplicitFields is true (used by taskfile.js), the returned object
 * also has a _explicitFields Set tracking which user-authored frontmatter keys
 * were present — used to diff only explicitly set fields against the plist.
 */
export function parseMdFile(filePath, { includeExplicitFields = false } = {}) {
  const settings = readSettings()
  const raw = fs.readFileSync(filePath, 'utf8')
  const { data: fm, content: body } = matter(raw)

  const INTERNAL_KEYS = new Set(['_id'])

  const result = {
    id: fm['_id'] != null ? String(fm['_id']) : null,
    name: fm.name || path.basename(filePath, '.md'),
    argument: body.trim(),
    schedule: parseSchedule(fm.schedule),
    workingDirectory: fm.workingDirectory
      ? fm.workingDirectory.replace(/^~/, os.homedir())
      : os.homedir(),
    env: fm.env || {},
    maxRetries: fm.maxRetries ?? 0,
    resultRetentionDays: fm.resultRetentionDays ?? 30,
    profileKey: typeof fm.profile === 'string' ? fm.profile : null,
    profile: (typeof fm.profile === 'string' ? settings.profiles?.[fm.profile] : null) ?? null,
    timeoutSeconds: fm.timeoutSeconds ?? null,
    sourcePath: filePath,
  }

  if (includeExplicitFields) {
    const _explicitFields = new Set(
      Object.keys(fm).filter(k => !INTERNAL_KEYS.has(k))
    )
    _explicitFields.add('argument')
    result._explicitFields = _explicitFields
  }

  return result
}

/**
 * Write (or update) underscore-prefixed internal fields in a .md file's frontmatter.
 * Only internal keys (_id) are touched; user keys are left unchanged.
 */
export function writeTideFields(filePath, fields) {
  const raw = fs.readFileSync(filePath, 'utf8')
  // Split into frontmatter block and everything after the closing ---
  // Format: ---\n<yaml>\n---\n<body>
  const fmEnd = raw.indexOf('\n---', raw.indexOf('---') + 3)
  const fmBlock = fmEnd !== -1 ? raw.slice(0, fmEnd + 4) : raw
  const bodyPart = fmEnd !== -1 ? raw.slice(fmEnd + 4) : ''

  let fm = fmBlock
  for (const [k, v] of Object.entries(fields)) {
    const yamlValue = typeof v === 'boolean' ? String(v) : JSON.stringify(v)
    const quotedKey = `'${k}'`
    const keyRe = new RegExp(`^(${quotedKey}|${k}):\\s*.+$\n?`, 'mg')
    const stripped = fm.replace(keyRe, '')
    // Insert before closing ---
    fm = stripped.replace(/\n---$/, `\n${k}: ${yamlValue}\n---`)
  }
  const tmp = filePath + '.tmp'
  fs.writeFileSync(tmp, fm + bodyPart)
  fs.renameSync(tmp, filePath)
}
