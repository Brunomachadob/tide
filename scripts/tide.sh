#!/bin/zsh
# tide.sh <task-id>
# Thin shell wrapper: reads config, initializes a run, runs the command, delegates post-processing to Node.
set -uo pipefail

TASK_ID="${1:?tide.sh requires a task ID}"
TIDE_DIR="${HOME}/.tide"
TASK_DIR="${TIDE_DIR}/tasks/${TASK_ID}"
TASK_FILE="${TIDE_TASK_FILE:?TIDE_TASK_FILE must be set (plist missing TIDE_TASK_FILE env var)}"
SCRIPT_DIR="${0:A:h}"

now() { date -u '+%Y-%m-%dT%H:%M:%SZ' }

if [[ ! -f "${TASK_FILE}" ]]; then
  echo "[$(now)] ERROR: task file not found: ${TASK_FILE}" >&2
  exit 1
fi

# Overlapping run detection via PID file
PID_FILE="${TASK_DIR}/running.pid"
if [[ -f "${PID_FILE}" ]]; then
  EXISTING_PID="$(cat "${PID_FILE}" 2>/dev/null)"
  if [[ -n "${EXISTING_PID}" ]] && kill -0 "${EXISTING_PID}" 2>/dev/null; then
    echo "[$(now)] Skipping: task already running (PID ${EXISTING_PID})" >&2
    exit 0
  fi
  rm -f "${PID_FILE}"
fi
echo $$ > "${PID_FILE}"

EXIT_CODE=1
attempt=0

finish() {
  rm -f "${PID_FILE}"
  local COMPLETED_AT="$(now)"
  node "${SCRIPT_DIR}/task-postprocess.js" \
    "${TASK_FILE}" "${EXIT_CODE}" "${STARTED_AT}" "${COMPLETED_AT}" "${attempt}" \
    "${RUN_DIR}"
}
trap finish EXIT

# Read config and initialize run via Node (emits shell vars including RUN_ID, RUN_DIR, STARTED_AT)
eval "$(node "${SCRIPT_DIR}/task-setup.js" "${TASK_FILE}")"

OUTPUT_LOG="${RUN_DIR}/output.log"
STDERR_LOG="${RUN_DIR}/stderr.log"

# Jitter: spread tasks after wake so they don't all fire simultaneously.
# Skipped when TIDE_NO_JITTER=1 (manual runs).
if [[ ${JITTER_SECONDS} -gt 0 && "${TIDE_NO_JITTER:-0}" != "1" ]]; then
  echo "[$(now)] Jitter: waiting ${JITTER_SECONDS}s before starting..." >> "${OUTPUT_LOG}"
  sleep ${JITTER_SECONDS}
fi

# Run with retries
while [[ ${attempt} -le ${MAX_RETRIES} ]]; do
  if [[ ${attempt} -gt 0 ]]; then
    BACKOFF=$((attempt * 30))
    echo "[$(now)] Retry ${attempt}/${MAX_RETRIES} after ${BACKOFF}s..." >> "${OUTPUT_LOG}"
    sleep ${BACKOFF}
  fi

  CMD_ARRAY=(${=COMMAND})
  set +e
  if [[ "${CLAUDE_STREAM_JSON}" == "1" ]]; then
    cd "${WORKING_DIR}" && "${CMD_ARRAY[@]}" ${=EXTRA_ARGS} "${ARGUMENT}" 2>> "${STDERR_LOG}" | \
      node "${SCRIPT_DIR}/claude-stream-extract.js" >> "${OUTPUT_LOG}"
    EXIT_CODE=${pipestatus[1]}
  else
    cd "${WORKING_DIR}" && "${CMD_ARRAY[@]}" ${=EXTRA_ARGS} "${ARGUMENT}" >> "${OUTPUT_LOG}" 2>> "${STDERR_LOG}"
    EXIT_CODE=$?
  fi
  set -e

  attempt=$((attempt + 1))
  [[ ${EXIT_CODE} -eq 0 ]] && break
done

# macOS native notification (skipped when TIDE_NO_NOTIFY=1)
# Note: finish() trap runs after this block on EXIT
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

echo "[$(now)] Task '${TASK_NAME}' (${TASK_ID}) run=${RUN_ID} exit=${EXIT_CODE} attempts=${attempt}"
