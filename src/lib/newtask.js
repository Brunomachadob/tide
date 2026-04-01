// Opens a new task .md file in the user's $EDITOR.
import fs from 'fs'
import path from 'path'
import os from 'os'
import { spawnSync } from 'child_process'
import { readSettings } from './settings.js'

function buildTemplate(settings, repoRoot) {
  const workDir = repoRoot || settings.defaultWorkingDirectory || os.homedir()
  return `---
name: My task
schedule: 1h
workingDirectory: ${workDir}
# command: /opt/homebrew/bin/claude --permission-mode bypassPermissions -p
# maxRetries: 0
# claudeStreamJson: false
---

Describe what this task should do.
`
}

/**
 * Create a template .md file in <repoRoot>/.tide/ and open it in $EDITOR.
 * After the editor closes, the next refresh will pick it up as a pending-create.
 */
export function openNewTaskFile(repoRoot) {
  const tidePath = path.join(repoRoot, '.tide')
  fs.mkdirSync(tidePath, { recursive: true })
  const filePath = path.join(tidePath, `task-${Date.now()}.md`)
  fs.writeFileSync(filePath, buildTemplate(readSettings(), repoRoot))
  const editor = process.env.EDITOR || process.env.VISUAL || 'vi'
  spawnSync(editor, [filePath], { stdio: 'inherit' })
}
