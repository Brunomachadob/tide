import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

const { tshAuth, AUTH_HANDLERS } =
  await import('../scripts/lib/agent-auth.js?bust=1')

const VALID_ENV = {
  AWS_ACCESS_KEY_ID: 'AKIAIOSFODNN7EXAMPLE',
  AWS_SECRET_ACCESS_KEY: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
  HTTPS_PROXY: 'http://127.0.0.1:8080',
}

describe('tshAuth', () => {
  test('throws when AWS_ACCESS_KEY_ID is missing', async () => {
    const env = { ...VALID_ENV }
    delete env.AWS_ACCESS_KEY_ID
    await assert.rejects(
      () => tshAuth({}, env, 'some-model'),
      /AWS_ACCESS_KEY_ID/,
    )
  })

  test('throws when AWS_SECRET_ACCESS_KEY is missing', async () => {
    const env = { ...VALID_ENV }
    delete env.AWS_SECRET_ACCESS_KEY
    await assert.rejects(
      () => tshAuth({}, env, 'some-model'),
      /AWS_SECRET_ACCESS_KEY/,
    )
  })

  test('throws when HTTPS_PROXY is missing', async () => {
    const env = { ...VALID_ENV }
    delete env.HTTPS_PROXY
    await assert.rejects(
      () => tshAuth({}, env, 'some-model'),
      /HTTPS_PROXY/,
    )
  })

  test('throws when model is missing', async () => {
    await assert.rejects(
      () => tshAuth({}, VALID_ENV, null),
      /model is required/,
    )
  })

  test('returns model and modelOverrides for a plain model ID', async () => {
    const result = await tshAuth({}, VALID_ENV, 'claude-sonnet-4-6')
    assert.equal(result.model, 'claude-sonnet-4-6')
    assert.deepEqual(result.settings.modelOverrides, {
      'claude-sonnet-4-6': 'claude-sonnet-4-6',
    })
  })

  test('does not add Anthropic ID mappings when model is not an ARN', async () => {
    const result = await tshAuth({}, VALID_ENV, 'claude-sonnet-4-6')
    assert.equal(Object.keys(result.settings.modelOverrides).length, 1)
  })

  test('maps Bedrock ARN to itself', async () => {
    const arn = 'arn:aws:bedrock:eu-central-1:123456789:inference-profile/test'
    const result = await tshAuth({}, VALID_ENV, arn)
    assert.equal(result.settings.modelOverrides[arn], arn)
  })

  test('maps known Anthropic IDs to the ARN when model is a Bedrock ARN', async () => {
    const arn = 'arn:aws:bedrock:eu-central-1:123456789:inference-profile/test'
    const result = await tshAuth({}, VALID_ENV, arn)
    const overrides = result.settings.modelOverrides
    assert.equal(overrides['claude-sonnet-4-6'], arn)
    assert.equal(overrides['claude-opus-4-6'], arn)
    assert.equal(overrides['claude-haiku-4-5'], arn)
  })

  test('returns the ARN as the model value', async () => {
    const arn = 'arn:aws:bedrock:eu-central-1:123456789:inference-profile/test'
    const result = await tshAuth({}, VALID_ENV, arn)
    assert.equal(result.model, arn)
  })
})

describe('AUTH_HANDLERS', () => {
  test("contains 'tsh' key", () => {
    assert.ok('tsh' in AUTH_HANDLERS)
  })

  test("'tsh' is tshAuth", () => {
    assert.equal(AUTH_HANDLERS['tsh'], tshAuth)
  })
})
