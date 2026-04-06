// Gemini agent plugin for agent-runner.js.
// Plugin interface: runOnce(opts) → Promise<{ exitCode: number }>
import { streamText } from 'ai'
import { createGeminiProvider } from 'ai-sdk-provider-gemini-cli'

/**
 * Run one Gemini agent attempt via the Vercel AI SDK + gemini-cli provider.
 *
 * @param {object} opts
 * @param {string}         opts.argument     — the prompt to run
 * @param {fs.WriteStream} opts.outputStream — stream to write text output to
 * @param {object}         opts.sdkOptions   — { authType, model, apiKey?, vertexAI?, ... }
 * @param {Function}       opts.log
 * @returns {Promise<{ exitCode: number }>}
 */
export async function runOnce({ argument, outputStream, sdkOptions = {}, log }) {
  const { model = 'gemini-2.5-pro', authType = 'oauth-personal', apiKey, vertexAI, googleAuth, ...rest } = sdkOptions
  log(`model: ${model}  auth: ${authType}`)

  const providerConfig = { authType, ...(apiKey ? { apiKey } : {}), ...(vertexAI ? { vertexAI } : {}), ...(googleAuth ? { googleAuth } : {}) }
  const gemini = createGeminiProvider(providerConfig)

  const result = await streamText({ model: gemini(model), prompt: argument, ...rest })

  let chunkCount = 0
  for await (const chunk of result.textStream) {
    outputStream.write(chunk)
    chunkCount++
  }

  if (chunkCount === 0) {
    const text = await result.text
    if (text) {
      outputStream.write(text)
      log(`used resolved text (${text.length} chars)`)
    } else {
      log('warning: no output received from model')
    }
  }

  outputStream.write('\n')
  return { exitCode: 0 }
}
