#!/bin/zsh
# tide.sh <task-id>
# Entry point invoked by launchd. Reads agentAuth config from the task file
# and delegates execution to agent-runner.js via tsh aws --exec.
set -uo pipefail

TASK_ID="${1:?tide.sh requires a task ID}"
TASK_FILE="${TIDE_TASK_FILE:?TIDE_TASK_FILE must be set (plist missing TIDE_TASK_FILE env var)}"
SCRIPT_DIR="${0:A:h}"

if [[ ! -f "${TASK_FILE}" ]]; then
  echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] ERROR: task file not found: ${TASK_FILE}" >&2
  exit 1
fi

# Read agentAuth fields from the task frontmatter and exec into tsh.
# agent-runner.js owns the full run lifecycle from here.
eval "$(node -e "
const matter = require('${SCRIPT_DIR}/../node_modules/gray-matter/index.js')
const fs = require('fs')
const fm = matter(fs.readFileSync('${TASK_FILE}', 'utf8')).data
const auth = fm.agentAuth || {}
const q = v => \"'\" + String(v).replace(/'/g, \"'\\\\\\\\''\" ) + \"'\"
console.log('AGENT_AUTH_TELEPORT_PROXY=' + q(auth.teleportProxy || ''))
console.log('AGENT_AUTH_APP=' + q(auth.app || ''))
console.log('AGENT_AUTH_AWS_ROLE=' + q(auth.awsRole || ''))
")"

exec tsh aws \
  --proxy "${AGENT_AUTH_TELEPORT_PROXY}" \
  --auth "okta" \
  --app "${AGENT_AUTH_APP}" \
  --aws-role "${AGENT_AUTH_AWS_ROLE}" \
  --exec node -- "${SCRIPT_DIR}/agent-runner.js" "${TASK_ID}"
