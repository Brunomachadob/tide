import fs from 'fs'

/** Read and parse a JSON file. Returns defaultValue if missing or unparseable. */
export function safeReadJSON(filePath, defaultValue = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch {
    return defaultValue
  }
}

/** Write data as JSON atomically via a tmp-then-rename. */
export function atomicWriteJSON(filePath, data) {
  const tmp = filePath + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2))
  fs.renameSync(tmp, filePath)
}
