import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import matter from 'gray-matter'

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'tide-test-taskfile-'))
process.env.HOME = TMP

const { writeTideFields } = await import('../src/lib/mdfields.js?bust=1')

function write(name, content) {
  const p = path.join(TMP, name)
  fs.writeFileSync(p, content)
  return p
}

describe('writeTideFields', () => {
  test('updates existing key', () => {
    const p = write('update.md', '---\nname: foo\n_id: "old"\n---\nbody\n')
    writeTideFields(p, { _id: 'new' })
    const { data } = matter(fs.readFileSync(p, 'utf8'))
    assert.equal(data._id, 'new')
    assert.equal(data.name, 'foo')
  })

  test('inserts new key inside frontmatter, not before opening ---', () => {
    const p = write('insert.md', '---\nname: foo\n---\nbody\n')
    writeTideFields(p, { _id: 'abc' })
    const raw = fs.readFileSync(p, 'utf8')
    // Must start with ---
    assert.ok(raw.startsWith('---\n'), `file must start with ---\\n, got: ${JSON.stringify(raw.slice(0, 20))}`)
    // gray-matter must parse _id correctly
    const { data, content } = matter(raw)
    assert.equal(data._id, 'abc')
    assert.equal(data.name, 'foo')
    assert.ok(content.trim() === 'body', 'body should be preserved')
  })

  test('inserts multiple new keys without duplicating ---', () => {
    const p = write('multi.md', '---\nname: bar\n---\nbody\n')
    writeTideFields(p, { _id: 'x1', _jitter: 30 })
    const raw = fs.readFileSync(p, 'utf8')
    assert.ok(raw.startsWith('---\n'))
    const { data } = matter(raw)
    assert.equal(data._id, 'x1')
    assert.equal(data._jitter, 30)
    assert.equal(data.name, 'bar')
    // Should only have exactly two --- lines
    const dashes = raw.split('\n').filter(l => l === '---')
    assert.equal(dashes.length, 2, 'should have exactly 2 --- delimiters')
  })

  test('deduplicates key when already present multiple times', () => {
    const p = write('dup.md', '---\nname: dup\n_id: "old1"\n_id: "old2"\n---\nbody\n')
    writeTideFields(p, { _id: 'fixed' })
    const raw = fs.readFileSync(p, 'utf8')
    const { data } = matter(raw)
    assert.equal(data._id, 'fixed')
    // Only one _id line
    const idLines = raw.split('\n').filter(l => l.startsWith('_id:'))
    assert.equal(idLines.length, 1, 'should have exactly one _id line')
  })

  test('preserves body content after ---', () => {
    const p = write('body.md', '---\nname: baz\n---\n\nSome **body** content.\n')
    writeTideFields(p, { _id: 'y1' })
    const raw = fs.readFileSync(p, 'utf8')
    assert.ok(raw.includes('Some **body** content.'))
  })
})
