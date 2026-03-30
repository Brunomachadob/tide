#!/bin/zsh
# task-runner.sh <task-id>
# Called by launchd to execute a scheduled Claude task.
# Reads task config, runs claude26, captures output, writes result JSON, appends notification.
set -uo pipefail

TASK_ID="${1:?task-runner.sh requires a task ID}"
SCHEDULER_DIR="${HOME}/.claude/scheduler"
TASK_DIR="${SCHEDULER_DIR}/tasks/${TASK_ID}"
TASK_FILE="${TASK_DIR}/task.json"
PROMPT_FILE="${TASK_DIR}/prompt.txt"
RESULTS_DIR="${TASK_DIR}/results"
LOGS_DIR="${TASK_DIR}/logs"
NOTIFICATIONS_FILE="${SCHEDULER_DIR}/pending-notifications.json"
CLAUDE_OUTPUT_LOG="${LOGS_DIR}/output.log"
STDERR_LOG="${LOGS_DIR}/stderr.log"

mkdir -p "${RESULTS_DIR}" "${LOGS_DIR}"

# Overlapping run detection via PID file
PID_FILE="${TASK_DIR}/running.pid"
if [[ -f "${PID_FILE}" ]]; then
  EXISTING_PID="$(cat "${PID_FILE}" 2>/dev/null)"
  if [[ -n "${EXISTING_PID}" ]] && kill -0 "${EXISTING_PID}" 2>/dev/null; then
    echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] Skipping: task already running (PID ${EXISTING_PID})" >&2
    exit 0
  fi
  rm -f "${PID_FILE}"
fi
echo $$ > "${PID_FILE}"
trap 'rm -f "${PID_FILE}"' EXIT

TIMESTAMP="$(python3 -c "from datetime import datetime,timezone; print(datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'))")"
RESULT_FILE="${RESULTS_DIR}/${TIMESTAMP}.json"

# Read task config
if [[ ! -f "${TASK_FILE}" ]]; then
  echo "[${TIMESTAMP}] ERROR: task file not found: ${TASK_FILE}" >&2
  exit 1
fi

TASK_JSON="$(cat "${TASK_FILE}")"

COMMAND="$(python3 -c "
import json,sys,os,subprocess
d=json.loads(sys.argv[1])
cmd=d.get('command','')
if not cmd:
    settings_file=os.path.join(os.path.expanduser('~'),'.claude','scheduler','tui-settings.json')
    try:
        with open(settings_file) as f:
            cmd=json.load(f).get('command','')
    except Exception:
        pass
if not cmd:
    r=subprocess.run(['which','claude'],capture_output=True,text=True)
    cmd=r.stdout.strip() if r.returncode==0 else '/opt/homebrew/bin/claude26'
print(cmd)
" "${TASK_JSON}")"
EXTRA_ARGS="$(python3 -c "import json,sys; d=json.loads(sys.argv[1]); print(' '.join(d.get('extraArgs',[])))" "${TASK_JSON}")"
MAX_RETRIES="$(python3 -c "import json,sys; d=json.loads(sys.argv[1]); print(d.get('maxRetries',0))" "${TASK_JSON}")"
TASK_NAME="$(python3 -c "import json,sys; d=json.loads(sys.argv[1]); print(d.get('name','unnamed'))" "${TASK_JSON}")"
WORKING_DIR="$(python3 -c "import json,sys,os; d=json.loads(sys.argv[1]); print(d.get('workingDirectory',os.path.expanduser('~')))" "${TASK_JSON}" 2>/dev/null || echo "${HOME}")"
# Permission mode: default bypassPermissions so headless tasks never hang waiting for input.
# Can be overridden per-task to e.g. "default" or "acceptEdits" for more restricted runs.
PERMISSION_MODE="$(python3 -c "import json,sys; d=json.loads(sys.argv[1]); print(d.get('permissionMode','bypassPermissions'))" "${TASK_JSON}")"
RESULT_RETENTION_DAYS="$(python3 -c "import json,sys; d=json.loads(sys.argv[1]); print(d.get('resultRetentionDays',30))" "${TASK_JSON}")"

if [[ ! -f "${PROMPT_FILE}" ]]; then
  echo "[${TIMESTAMP}] ERROR: prompt file not found: ${PROMPT_FILE}" >&2
  exit 1
fi

# Append run header to output and stderr logs
echo "=== ${TIMESTAMP} ===" >> "${CLAUDE_OUTPUT_LOG}"
echo "=== ${TIMESTAMP} ===" >> "${STDERR_LOG}"

# Run with retries
attempt=0
EXIT_CODE=1
OUTPUT=""

while [[ ${attempt} -le ${MAX_RETRIES} ]]; do
  if [[ ${attempt} -gt 0 ]]; then
    BACKOFF=$((attempt * 30))
    echo "[${TIMESTAMP}] Retry ${attempt}/${MAX_RETRIES} after ${BACKOFF}s..." >> "${CLAUDE_OUTPUT_LOG}"
    sleep ${BACKOFF}
  fi

  # Run claude26 with the prompt file contents.
  # --permission-mode bypassPermissions (default) ensures the headless session never
  # hangs waiting for a tool-use permission prompt that nobody can answer.
  # Stdout (Claude's response) goes to the output log; stderr goes to stderr log.
  set +e
  OUTPUT="$(cd "${WORKING_DIR}" && "${COMMAND}" -p "$(cat "${PROMPT_FILE}")" \
    --permission-mode "${PERMISSION_MODE}" \
    ${EXTRA_ARGS} 2>>"${STDERR_LOG}")"
  EXIT_CODE=$?
  set -e

  # Write Claude's response to the output log
  printf '%s\n' "${OUTPUT}" >> "${CLAUDE_OUTPUT_LOG}"

  [[ ${EXIT_CODE} -eq 0 ]] && break
  attempt=$((attempt + 1))
done

COMPLETED_AT="$(python3 -c "from datetime import datetime,timezone; print(datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'))")"

# Append run footer to output and stderr logs
echo "--- exit ${EXIT_CODE} at ${COMPLETED_AT} ---" >> "${CLAUDE_OUTPUT_LOG}"
echo "" >> "${CLAUDE_OUTPUT_LOG}"
echo "--- exit ${EXIT_CODE} at ${COMPLETED_AT} ---" >> "${STDERR_LOG}"
echo "" >> "${STDERR_LOG}"

# Truncate output for summary (first 300 chars)
SUMMARY="$(printf '%s' "${OUTPUT}" | head -c 300)"

# Write structured result JSON
python3 - <<PYEOF
import json

result = {
    "taskId": "${TASK_ID}",
    "taskName": "${TASK_NAME}",
    "startedAt": "${TIMESTAMP}",
    "completedAt": "${COMPLETED_AT}",
    "exitCode": int("${EXIT_CODE}"),
    "attempts": int("${attempt}") + 1,
    "output": """${OUTPUT}""",
}
with open("${RESULT_FILE}", "w") as f:
    json.dump(result, f, indent=2)
PYEOF

# Append to pending-notifications.json (atomic via temp file)
python3 - <<PYEOF
import json, os, tempfile

notifications_file = "${NOTIFICATIONS_FILE}"

if os.path.exists(notifications_file):
    with open(notifications_file) as f:
        try:
            entries = json.load(f)
        except Exception:
            entries = []
else:
    entries = []

entries.append({
    "taskId": "${TASK_ID}",
    "taskName": "${TASK_NAME}",
    "completedAt": "${COMPLETED_AT}",
    "exitCode": int("${EXIT_CODE}"),
    "resultFile": "${RESULT_FILE}",
    "summary": """${SUMMARY}""",
})

dir_ = os.path.dirname(notifications_file)
fd, tmp = tempfile.mkstemp(dir=dir_)
try:
    with os.fdopen(fd, "w") as f:
        json.dump(entries, f, indent=2)
    os.replace(tmp, notifications_file)
except Exception:
    os.unlink(tmp)
    raise
PYEOF

# Log rotation: cap output.log and stderr.log at 5MB
rotate_log() {
  local logfile="$1"
  local max_bytes=$((5 * 1024 * 1024))
  if [[ -f "${logfile}" ]]; then
    local size
    size=$(python3 -c "import os; print(os.path.getsize('${logfile}'))" 2>/dev/null || echo 0)
    if [[ ${size} -gt ${max_bytes} ]]; then
      # Keep last 2MB worth of content
      local keep_bytes=$((2 * 1024 * 1024))
      python3 -c "
import os
with open('${logfile}', 'rb') as f:
    f.seek(0, 2)
    size = f.tell()
    f.seek(max(-${keep_bytes}, -size), 2)
    data = f.read()
with open('${logfile}', 'wb') as f:
    f.write(b'[... rotated ...]\n')
    f.write(data)
" 2>/dev/null || true
    fi
  fi
}
rotate_log "${CLAUDE_OUTPUT_LOG}"
rotate_log "${STDERR_LOG}"

# Result retention: prune result JSON files older than resultRetentionDays
python3 - <<PYEOF
import os, time

results_dir = "${RESULTS_DIR}"
retention_days = int("${RESULT_RETENTION_DAYS}")
cutoff = time.time() - retention_days * 86400

if os.path.isdir(results_dir):
    for fname in os.listdir(results_dir):
        if not fname.endswith('.json'):
            continue
        fpath = os.path.join(results_dir, fname)
        try:
            if os.path.getmtime(fpath) < cutoff:
                os.unlink(fpath)
        except Exception:
            pass
PYEOF

# macOS native notification
if [[ ${EXIT_CODE} -eq 0 ]]; then
  NOTIF_TITLE="Scheduler: ${TASK_NAME} ✓"
  NOTIF_MSG="Task completed successfully."
else
  NOTIF_TITLE="Scheduler: ${TASK_NAME} ✗"
  NOTIF_MSG="Task failed (exit ${EXIT_CODE})."
fi
osascript -e "display notification \"${NOTIF_MSG}\" with title \"${NOTIF_TITLE}\"" 2>/dev/null || true

# Status line to plist's StandardOutPath (wrapper metadata only)
echo "[${COMPLETED_AT}] Task '${TASK_NAME}' (${TASK_ID}) exit=${EXIT_CODE} attempts=$((attempt+1))"
