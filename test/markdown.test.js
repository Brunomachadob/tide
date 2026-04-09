import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { renderMarkdown } from '../src/lib/markdown.js'

describe('renderMarkdown', () => {
  test('returns falsy input unchanged', () => {
    assert.equal(renderMarkdown(''), '')
    assert.equal(renderMarkdown(null), null)
    assert.equal(renderMarkdown(undefined), undefined)
  })

  test('trims trailing newlines to a single newline', () => {
    const out = renderMarkdown('hello')
    assert.ok(out.endsWith('\n'), 'should end with newline')
    assert.ok(!out.endsWith('\n\n'), 'should not end with double newline')
  })
})
