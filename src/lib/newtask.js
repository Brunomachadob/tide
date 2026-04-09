// Opens a new task .md file in the user's $EDITOR.
import fs from 'fs'
import path from 'path'
import { spawnSync } from 'child_process'
import { readSettings } from './settings.js'

function buildTemplate(settings, repoRoot) {
  const workDir = repoRoot || process.cwd()
  const defaultProfileKey = Object.keys(settings.profiles || {})[0] || 'my-profile'
  return `---
name: My task
schedule: 1h
workingDirectory: ${workDir}
profile: ${defaultProfileKey}
maxRetries: 0
resultRetentionDays: 30
---

Describe what this task should do.
`
}

/**
 * Create a template .md file in <repoRoot>/.tide/ and open it in $EDITOR.
 * After the editor closes, the next refresh will pick it up as a pending-create.
 */
function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function uniquePath(tidePath, base) {
  let candidate = path.join(tidePath, `${base}.md`)
  if (!fs.existsSync(candidate)) return candidate
  let i = 2
  while (fs.existsSync(candidate = path.join(tidePath, `${base}-${i}.md`))) i++
  return candidate
}

export function openNewTaskFile(repoRoot) {
  const tidePath = path.join(repoRoot, '.tide')
  fs.mkdirSync(tidePath, { recursive: true })
  const settings = readSettings()
  const template = buildTemplate(settings, repoRoot)
  const tmpPath = path.join(tidePath, `.new-task-${Date.now()}.md`)
  fs.writeFileSync(tmpPath, template)
  const editor = process.env.EDITOR || process.env.VISUAL || 'vi'
  spawnSync(editor, [tmpPath], { stdio: 'inherit' })
  if (!fs.existsSync(tmpPath)) return
  const saved = fs.readFileSync(tmpPath, 'utf8')
  const nameMatch = saved.match(/^name:[ \t]*(.+)$/m)
  const slug = (nameMatch ? slugify(nameMatch[1].trim()) : '') || 'task'
  const finalPath = uniquePath(tidePath, slug)
  fs.renameSync(tmpPath, finalPath)
}
