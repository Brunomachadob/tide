// Worker thread: runs loadTasks() off the main thread and posts results back.
import { workerData, parentPort } from 'worker_threads'
import { loadTasks } from './load-tasks.js'

try {
  const tasks = loadTasks(workerData.repoRoot)
  parentPort.postMessage({ ok: true, tasks })
} catch (e) {
  parentPort.postMessage({ ok: false, error: e.message })
}
