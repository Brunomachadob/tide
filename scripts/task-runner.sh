#!/bin/zsh
# task-runner.sh <task-id>
# Thin shell wrapper: reads config, runs the command, delegates post-processing to Node.
set -uo pipefail

TASK_ID="${1:?task-runner.sh requires a task ID}"
TIDE_DIR="${HOME}/.tide"
TASK_DIR="${TIDE_DIR}/tasks/${TASK_ID}"
TASK_FILE="${TASK_DIR}/task.json"
RESULTS_DIR="${TASK_DIR}/results"
LOGS_DIR="${TASK_DIR}/logs"
OUTPUT_LOG="${LOGS_DIR}/output.log"
STDERR_LOG="${LOGS_DIR}/stderr.log"
SCRIPT_DIR="${0:A:h}"

now() { date -u '+%Y-%m-%dT%H:%M:%SZ' }

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

if [[ ! -f "${TASK_FILE}" ]]; then
  echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] ERROR: task file not found: ${TASK_FILE}" >&2
  exit 1
fi

STARTED_AT="$(now)"
echo "=== ${STARTED_AT} ===" >> "${OUTPUT_LOG}"
echo "=== ${STARTED_AT} ===" >> "${STDERR_LOG}"

# Read config via Node
eval "$(node "${SCRIPT_DIR}/task-setup.js" "${TASK_FILE}")"

# Jitter: spread tasks after wake so they don't all fire simultaneously.
# Skipped when TIDE_NO_JITTER=1 (manual runs).
if [[ ${JITTER_SECONDS} -gt 0 && "${TIDE_NO_JITTER:-0}" != "1" ]]; then
  echo "[$(now)] Jitter: waiting ${JITTER_SECONDS}s before starting..." >> "${OUTPUT_LOG}"
  sleep ${JITTER_SECONDS}
fi

# Run with retries
attempt=0
EXIT_CODE=1

while [[ ${attempt} -le ${MAX_RETRIES} ]]; do
  if [[ ${attempt} -gt 0 ]]; then
    BACKOFF=$((attempt * 30))
    echo "[$(now)] Retry ${attempt}/${MAX_RETRIES} after ${BACKOFF}s..." >> "${OUTPUT_LOG}"
    sleep ${BACKOFF}
  fi

  CMD_ARRAY=(${=COMMAND})
  set +e
  cd "${WORKING_DIR}" && "${CMD_ARRAY[@]}" ${=EXTRA_ARGS} "${ARGUMENT}" >> "${OUTPUT_LOG}" 2>> "${STDERR_LOG}"
  EXIT_CODE=$?
  set -e

  attempt=$((attempt + 1))
  [[ ${EXIT_CODE} -eq 0 ]] && break
done

COMPLETED_AT="$(now)"
echo "--- exit ${EXIT_CODE} at ${COMPLETED_AT} ---" >> "${OUTPUT_LOG}"
echo "" >> "${OUTPUT_LOG}"
echo "--- exit ${EXIT_CODE} at ${COMPLETED_AT} ---" >> "${STDERR_LOG}"
echo "" >> "${STDERR_LOG}"

# Delegate JSON writing, notifications, log rotation, and retention to Node
node "${SCRIPT_DIR}/task-postprocess.js" \
  "${TASK_FILE}" "${EXIT_CODE}" "${STARTED_AT}" "${COMPLETED_AT}" "$((attempt))" \
  "${OUTPUT_LOG}" "${STDERR_LOG}"

# macOS native notification (skipped when TIDE_NO_NOTIFY=1)
if [[ "${TIDE_NO_NOTIFY:-0}" != "1" ]]; then
  if [[ ${EXIT_CODE} -eq 0 ]]; then
    NOTIF_TITLE="Tide: ${TASK_NAME} ✓"
    NOTIF_MSG="Task completed successfully."
  else
    NOTIF_TITLE="Tide: ${TASK_NAME} ✗"
    NOTIF_MSG="Task failed (exit ${EXIT_CODE})."
  fi
  if command -v terminal-notifier &>/dev/null; then
    terminal-notifier -title "${NOTIF_TITLE}" -message "${NOTIF_MSG}" -activate "${TERMINAL_BUNDLE_ID}" 2>/dev/null &
  else
    osascript -e "display notification \"${NOTIF_MSG}\" with title \"${NOTIF_TITLE}\"" 2>/dev/null &
  fi
fi

echo "[${COMPLETED_AT}] Task '${TASK_NAME}' (${TASK_ID}) exit=${EXIT_CODE} attempts=$((attempt+1))"
