// Opens a new task .md file in the user's $EDITOR.
import fs from 'fs'
import path from 'path'
import os from 'os'
import { spawnSync } from 'child_process'
import { readSettings } from './settings.js'

function buildTemplate(settings, repoRoot) {
  const workDir = repoRoot || settings.defaultWorkingDirectory || os.homedir()
  const auth = settings.agentAuth || {}
  return `---
name: My task
schedule: 1h
workingDirectory: ${workDir}
agentAuth:
  strategy: ${auth.strategy || 'tsh-okta-bedrock'}
  app: ${auth.app || 'n26-dev-eu'}
  awsRole: ${auth.awsRole || 'bedrock-developer-user'}
  teleportProxy: ${auth.teleportProxy || 'teleport.access26.de:443'}
  model: ${auth.model || 'arn:aws:bedrock:eu-central-1:538639307912:application-inference-profile/xswegkx4emk1'}
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
