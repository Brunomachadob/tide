#!/bin/zsh
# tide.sh <task-id>
# Entry point invoked by launchd. Reads the TIDE_AGENT env var from the plist
# and delegates execution to agent-runner.js, wrapping with tsh aws for claude-code.
set -uo pipefail

TASK_ID="${1:?tide.sh requires a task ID}"
TASK_FILE="${TIDE_TASK_FILE:?TIDE_TASK_FILE must be set (plist missing TIDE_TASK_FILE env var)}"
SCRIPT_DIR="${0:A:h}"

if [[ ! -f "${TASK_FILE}" ]]; then
  echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] ERROR: task file not found: ${TASK_FILE}" >&2
  exit 1
fi

# TIDE_AGENT is set as an env var in the plist (written at sync time).
# For claude-code, also read tsh auth fields from settings via node.
# agent-runner.js owns the full run lifecycle from here.

eval "$(node -e "
const matter = require('${SCRIPT_DIR}/../node_modules/gray-matter/index.js')
const fs = require('fs')
const fm = matter(fs.readFileSync(process.env.TIDE_TASK_FILE, 'utf8')).data
const settings = JSON.parse(fs.readFileSync(process.env.HOME + '/.tide/settings.json', 'utf8') || '{}')
const profileKey = typeof fm.profile === 'string' ? fm.profile : null
const profile = (profileKey && settings.profiles?.[profileKey]) || {}
const auth = profile.auth || {}
const q = v => \"'\" + String(v).replace(/'/g, \"'\\\\\\\\''\" ) + \"'\"
console.log('AGENT_AUTH_TYPE=' + q(auth.type || ''))
console.log('AGENT_AUTH_TSH_AUTH=' + q(auth.auth || ''))
console.log('AGENT_AUTH_TELEPORT_PROXY=' + q(auth.teleportProxy || ''))
console.log('AGENT_AUTH_APP=' + q(auth.app || ''))
console.log('AGENT_AUTH_AWS_ROLE=' + q(auth.awsRole || ''))
")"

if [[ "${AGENT_AUTH_TYPE}" == "tsh" ]]; then
  exec tsh aws \
    --proxy "${AGENT_AUTH_TELEPORT_PROXY}" \
    --auth "${AGENT_AUTH_TSH_AUTH}" \
    --app "${AGENT_AUTH_APP}" \
    --aws-role "${AGENT_AUTH_AWS_ROLE}" \
    --exec node -- "${SCRIPT_DIR}/agent-runner.js" "${TASK_ID}"
else
  exec node -- "${SCRIPT_DIR}/agent-runner.js" "${TASK_ID}"
fi
