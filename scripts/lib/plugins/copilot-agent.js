// GitHub Copilot agent plugin for agent-runner.js.
// Plugin interface: runOnce(opts) → Promise<{ exitCode: number }>
import { CopilotClient, approveAll } from '@github/copilot-sdk'

/**
 * Run one GitHub Copilot agent attempt.
 *
 * @param {object} opts
 * @param {string}         opts.argument         — the prompt to run
 * @param {string}         opts.workingDirectory  — cwd for the agent
 * @param {fs.WriteStream} opts.outputStream      — stream to write text output to
 * @param {object}         opts.sdkOptions        — { clientOptions?, sessionOptions?, ... }
 * @returns {Promise<{ exitCode: number }>}
 */
export async function runOnce({ argument, workingDirectory, outputStream, sdkOptions = {}, log, logError }) {
  const { clientOptions = {}, sessionOptions = {}, ...restSdkOptions } = sdkOptions
  log(`working directory: ${workingDirectory}`)

  const client = new CopilotClient({ cwd: workingDirectory, ...clientOptions })
  try {
    await client.start()

    const session = await client.createSession({
      onPermissionRequest: approveAll,
      streaming: true,
      ...sessionOptions,
      ...restSdkOptions,
    })

    await new Promise((resolve, reject) => {
      session.on('assistant.message_delta', (event) => {
        outputStream.write(event.data.deltaContent)
      })
      session.on('session.idle', () => resolve())
      session.on('error', (err) => reject(err))

      session.send({ prompt: argument, cwd: workingDirectory }).catch(reject)
    })

    outputStream.write('\n')
    await session.disconnect()
    return { exitCode: 0 }
  } finally {
    await client.stop().catch(() => {})
  }
}
