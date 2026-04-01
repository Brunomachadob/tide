import { useState, useEffect, useCallback, useRef } from 'react'
import { Worker } from 'worker_threads'
import { fileURLToPath } from 'url'
import path from 'path'

const WORKER_PATH = path.resolve(fileURLToPath(import.meta.url), '../../lib/tasks-worker.js')

function spawnWorker(repoRoot, onResult) {
  const worker = new Worker(WORKER_PATH, { workerData: { repoRoot } })
  worker.once('message', onResult)
  worker.once('error', err => onResult({ ok: false, error: err.message }))
  return worker
}

export function useTasks(intervalMs = 5000, repoRoot = null) {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const workerRef = useRef(null)

  const refresh = useCallback(() => {
    // If a worker is already running, skip — don't pile up concurrent loads
    if (workerRef.current) return
    workerRef.current = spawnWorker(repoRoot, ({ ok, tasks: next, error: err }) => {
      workerRef.current = null
      if (ok) {
        setTasks(next)
        setError(null)
      } else {
        setError(err)
      }
      setLoading(false)
    })
  }, [repoRoot])

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, intervalMs)
    return () => {
      clearInterval(id)
      workerRef.current?.terminate()
      workerRef.current = null
    }
  }, [refresh, intervalMs])

  return { tasks, loading, error, refresh }
}

export function useTask(taskId, intervalMs = 5000, repoRoot = null) {
  const [task, setTask] = useState(null)
  const [loading, setLoading] = useState(true)
  const workerRef = useRef(null)

  const refresh = useCallback(() => {
    if (workerRef.current) return
    workerRef.current = spawnWorker(repoRoot, ({ ok, tasks }) => {
      workerRef.current = null
      if (ok) setTask(tasks.find(t => t.id === taskId) || null)
      else setTask(null)
      setLoading(false)
    })
  }, [taskId, repoRoot])

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, intervalMs)
    return () => {
      clearInterval(id)
      workerRef.current?.terminate()
      workerRef.current = null
    }
  }, [refresh, intervalMs])

  return { task, loading, refresh }
}
