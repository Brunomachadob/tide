// Auth handlers for agent-runner.js.
// Each handler is an async function: (auth, env) → sdkOptions.
// auth is the `auth` sub-object from a profile in settings.profiles.
// Pure functions — no file I/O, no side effects.

/**
 * tsh: validates that tsh has injected AWS credentials + proxy into env,
 * then returns SDK options that route the model to the Bedrock ARN.
 */
export async function tshAuth(auth, env, model) {
  const required = ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'HTTPS_PROXY']
  const missing = required.filter(k => !env[k])
  if (missing.length) {
    throw new Error(`tsh: missing env vars: ${missing.join(', ')}. Is tsh running?`)
  }
  if (!model) throw new Error('tsh: profile.model is required')

  const modelOverrides = { [model]: model }
  if (model.startsWith('arn:')) {
    modelOverrides['claude-sonnet-4-6'] = model
    modelOverrides['claude-opus-4-6'] = model
    modelOverrides['claude-haiku-4-5'] = model
  }

  return {
    model,
    settings: { modelOverrides },
  }
}

/**
 * copilot: passes through optional GitHub token and model/provider overrides
 * to the Copilot SDK session.
 */
export async function copilotAuth(auth, env) {
  const githubToken = auth.githubToken || env.COPILOT_GITHUB_TOKEN || env.GH_TOKEN || env.GITHUB_TOKEN
  return {
    clientOptions: githubToken ? { githubToken } : {},
    sessionOptions: {
      ...(auth.provider ? { provider: auth.provider } : {}),
    },
  }
}

/**
 * gemini: passes through auth config (authType, apiKey, vertexAI, etc.)
 * directly as sdkOptions for the gemini plugin.
 */
export async function geminiAuth(auth) {
  return {
    authType: auth.authType || 'oauth-personal',
    ...(auth.apiKey ? { apiKey: auth.apiKey } : {}),
    ...(auth.vertexAI ? { vertexAI: auth.vertexAI } : {}),
  }
}

/** Map of auth type → auth handler async function. */
export const AUTH_HANDLERS = {
  'tsh': tshAuth,
  'copilot': copilotAuth,
  'gemini': geminiAuth,
}
