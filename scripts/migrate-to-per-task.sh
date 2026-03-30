#!/bin/zsh
# migrate-to-per-task.sh
# Migrates from flat scheduler layout to per-task directory layout.
#
# Old layout:
#   ~/.claude/scheduler/tasks.json
#   ~/.claude/scheduler/prompts/<id>.txt
#   ~/.claude/scheduler/logs/<id>.{output,stderr,stdout}.log
#   ~/.claude/scheduler/results/<id>/<timestamp>.json
#
# New layout:
#   ~/.claude/scheduler/tasks/<id>/task.json
#   ~/.claude/scheduler/tasks/<id>/prompt.txt
#   ~/.claude/scheduler/tasks/<id>/logs/{output,stderr,stdout}.log
#   ~/.claude/scheduler/tasks/<id>/results/<timestamp>.json
set -euo pipefail

SCHEDULER_DIR="${HOME}/.claude/scheduler"
TASKS_FILE="${SCHEDULER_DIR}/tasks.json"
NEW_TASKS_DIR="${SCHEDULER_DIR}/tasks"

if [[ ! -f "${TASKS_FILE}" ]]; then
  echo "No tasks.json found — nothing to migrate."
  exit 0
fi

TASK_IDS=$(python3 -c "
import json
with open('${TASKS_FILE}') as f:
    data = json.load(f)
for t in data.get('tasks', []):
    print(t['id'])
")

if [[ -z "${TASK_IDS}" ]]; then
  echo "No tasks in tasks.json — nothing to migrate."
  exit 0
fi

echo "Migrating tasks to per-task directory layout..."

while IFS= read -r id; do
  TASK_DIR="${NEW_TASKS_DIR}/${id}"
  mkdir -p "${TASK_DIR}/logs" "${TASK_DIR}/results"

  # Write task.json from tasks.json entry
  python3 -c "
import json
with open('${TASKS_FILE}') as f:
    data = json.load(f)
task = next((t for t in data['tasks'] if t['id'] == '${id}'), None)
if task:
    with open('${TASK_DIR}/task.json', 'w') as f:
        json.dump(task, f, indent=2)
    print('  [${id}] task.json written')
else:
    print('  [${id}] WARNING: not found in tasks.json')
"

  # Move prompt file
  OLD_PROMPT="${SCHEDULER_DIR}/prompts/${id}.txt"
  if [[ -f "${OLD_PROMPT}" ]]; then
    cp "${OLD_PROMPT}" "${TASK_DIR}/prompt.txt"
    echo "  [${id}] prompt.txt migrated"
  fi

  # Move log files
  for TYPE in output stderr stdout; do
    OLD_LOG="${SCHEDULER_DIR}/logs/${id}.${TYPE}.log"
    if [[ -f "${OLD_LOG}" ]]; then
      cp "${OLD_LOG}" "${TASK_DIR}/logs/${TYPE}.log"
      echo "  [${id}] logs/${TYPE}.log migrated"
    fi
  done

  # Move results
  OLD_RESULTS="${SCHEDULER_DIR}/results/${id}"
  if [[ -d "${OLD_RESULTS}" ]]; then
    for f in "${OLD_RESULTS}"/*.json; do
      [[ -f "${f}" ]] || continue
      cp "${f}" "${TASK_DIR}/results/$(basename "${f}")"
    done
    COUNT=$(ls "${OLD_RESULTS}"/*.json 2>/dev/null | wc -l | tr -d ' ')
    echo "  [${id}] ${COUNT} result(s) migrated"
  fi

done <<< "${TASK_IDS}"

echo ""
echo "Migration complete. Old files left in place for safety."
echo "Once verified, you can remove:"
echo "  ${SCHEDULER_DIR}/tasks.json"
echo "  ${SCHEDULER_DIR}/prompts/"
echo "  ${SCHEDULER_DIR}/logs/"
echo "  ${SCHEDULER_DIR}/results/"
