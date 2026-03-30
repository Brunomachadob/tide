#!/bin/zsh
# task-runner.sh <task-id>
# Thin shell wrapper: reads config, runs the command, delegates post-processing to Node.
set -uo pipefail

TASK_ID="${1:?task-runner.sh requires a task ID}"
TIDE_DIR="${HOME}/.tide"
TASK_DIR="${TIDE_DIR}/tasks/${TASK_ID}"
TASK_FILE="${TASK_DIR}/task.json"
PROMPT_FILE="${TASK_DIR}/prompt.txt"
RESULTS_DIR="${TASK_DIR}/results"
LOGS_DIR="${TASK_DIR}/logs"
OUTPUT_LOG="${LOGS_DIR}/output.log"
STDERR_LOG="${LOGS_DIR}/stderr.log"
SCRIPT_DIR="${0:A:h}"

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

if [[ ! -f "${PROMPT_FILE}" ]]; then
  echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] ERROR: prompt file not found: ${PROMPT_FILE}" >&2
  exit 1
fi

# Read config via Node
eval "$(node "${SCRIPT_DIR}/task-postprocess.js" config "${TASK_FILE}")"

STARTED_AT="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo "=== ${STARTED_AT} ===" >> "${OUTPUT_LOG}"
echo "=== ${STARTED_AT} ===" >> "${STDERR_LOG}"

# Run with retries
attempt=0
EXIT_CODE=1
OUTPUT=""

while [[ ${attempt} -le ${MAX_RETRIES} ]]; do
  if [[ ${attempt} -gt 0 ]]; then
    BACKOFF=$((attempt * 30))
    echo "[${STARTED_AT}] Retry ${attempt}/${MAX_RETRIES} after ${BACKOFF}s..." >> "${OUTPUT_LOG}"
    sleep ${BACKOFF}
  fi

  CMD_ARRAY=(${=COMMAND})
  set +e
  OUTPUT="$(cd "${WORKING_DIR}" && "${CMD_ARRAY[@]}" ${=EXTRA_ARGS} "$(cat "${PROMPT_FILE}")" 2>>"${STDERR_LOG}")"
  EXIT_CODE=$?
  set -e

  printf '%s\n' "${OUTPUT}" >> "${OUTPUT_LOG}"
  [[ ${EXIT_CODE} -eq 0 ]] && break
  attempt=$((attempt + 1))
done

COMPLETED_AT="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo "--- exit ${EXIT_CODE} at ${COMPLETED_AT} ---" >> "${OUTPUT_LOG}"
echo "" >> "${OUTPUT_LOG}"
echo "--- exit ${EXIT_CODE} at ${COMPLETED_AT} ---" >> "${STDERR_LOG}"
echo "" >> "${STDERR_LOG}"

# Delegate JSON writing, notifications, log rotation, and retention to Node
node "${SCRIPT_DIR}/task-postprocess.js" post \
  "${TASK_FILE}" "${EXIT_CODE}" "${STARTED_AT}" "${COMPLETED_AT}" "$((attempt))" \
  "${OUTPUT}" "${OUTPUT_LOG}" "${STDERR_LOG}"

# macOS native notification
if [[ ${EXIT_CODE} -eq 0 ]]; then
  osascript -e "display notification \"Task completed successfully.\" with title \"Tide: ${TASK_NAME} ✓\"" 2>/dev/null || true
else
  osascript -e "display notification \"Task failed (exit ${EXIT_CODE}).\" with title \"Tide: ${TASK_NAME} ✗\"" 2>/dev/null || true
fi

echo "[${COMPLETED_AT}] Task '${TASK_NAME}' (${TASK_ID}) exit=${EXIT_CODE} attempts=$((attempt+1))"
