import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { renderMarkdown } from '../src/lib/markdown.js'

const BOLD      = '\x1b[1m'
const DIM       = '\x1b[2m'
const ITALIC    = '\x1b[3m'
const UNDERLINE = '\x1b[4m'
const REVERSE   = '\x1b[7m'
const CYAN      = '\x1b[36m'
const RESET     = '\x1b[0m'

describe('renderMarkdown', () => {
  test('returns falsy input unchanged', () => {
    assert.equal(renderMarkdown(''), '')
    assert.equal(renderMarkdown(null), null)
    assert.equal(renderMarkdown(undefined), undefined)
  })

  test('plain text is returned unchanged', () => {
    assert.equal(renderMarkdown('hello world'), 'hello world')
  })

  test('bold', () => {
    const out = renderMarkdown('**bold**')
    assert.ok(out.includes(BOLD), 'should contain bold escape')
    assert.ok(out.includes('bold'), 'should contain the text')
    assert.ok(!out.includes('**'), 'should strip ** markers')
  })

  test('italic', () => {
    const out = renderMarkdown('*italic*')
    assert.ok(out.includes(ITALIC))
    assert.ok(!out.includes('*italic*'))
  })

  test('bold takes precedence over italic when both present', () => {
    const out = renderMarkdown('**bold** and *italic*')
    assert.ok(out.includes(BOLD))
    assert.ok(out.includes(ITALIC))
  })

  test('inline code', () => {
    const out = renderMarkdown('use `foo()` here')
    assert.ok(out.includes(REVERSE))
    assert.ok(out.includes('foo()'))
    assert.ok(!out.includes('`foo()`'))
  })

  test('h1 — bold + underline, strips #', () => {
    const out = renderMarkdown('# Title')
    assert.ok(out.includes(BOLD))
    assert.ok(out.includes(UNDERLINE))
    assert.ok(out.includes('Title'))
    assert.ok(!out.includes('# '))
  })

  test('h2 — bold + underline, strips ##', () => {
    const out = renderMarkdown('## Section')
    assert.ok(out.includes(BOLD))
    assert.ok(out.includes(UNDERLINE))
    assert.ok(!out.includes('## '))
  })

  test('h3 — bold only, strips ###', () => {
    const out = renderMarkdown('### Sub')
    assert.ok(out.includes(BOLD))
    assert.ok(!out.includes('### '))
  })

  test('blockquote — dim + cyan bar', () => {
    const out = renderMarkdown('> quoted text')
    assert.ok(out.includes(DIM))
    assert.ok(out.includes(CYAN))
    assert.ok(out.includes('quoted text'))
    assert.ok(!out.startsWith('> '))
  })

  test('bullet list with -', () => {
    const out = renderMarkdown('- item one')
    assert.ok(out.includes('•'))
    assert.ok(!out.includes('- item'))
  })

  test('bullet list with *', () => {
    const out = renderMarkdown('* item two')
    assert.ok(out.includes('•'))
  })

  test('fenced code block — dim + bar prefix per line', () => {
    const out = renderMarkdown('```\nconst x = 1\nreturn x\n```')
    const lines = out.split('\n')
    assert.ok(lines.every(l => !l.trim() || l.includes(DIM)), 'all non-empty lines should be dim')
    assert.ok(lines.some(l => l.includes('│ const x = 1')))
    assert.ok(lines.some(l => l.includes('│ return x')))
    assert.ok(!out.includes('```'))
  })

  test('fenced code block with language hint', () => {
    const out = renderMarkdown('```js\nconsole.log("hi")\n```')
    assert.ok(out.includes('│ console.log'))
    assert.ok(!out.includes('```js'))
  })

  test('inline code inside fenced block is not double-processed', () => {
    const out = renderMarkdown('```\nuse `foo` here\n```')
    // The backtick content should stay literal inside a code block
    assert.ok(!out.includes(REVERSE))
  })

  const OSC8 = '\x1b]8;;'

  test('link — clickable OSC 8 hyperlink with underlined label', () => {
    const url = 'https://github.com/n26/terraform/pull/40075'
    const out = renderMarkdown(`[n26/terraform#40075](${url})`)
    assert.ok(out.includes(UNDERLINE), 'link text should be underlined')
    assert.ok(out.includes('n26/terraform#40075'), 'should contain link text')
    assert.ok(out.includes(OSC8 + url), 'should contain OSC 8 open sequence with url')
    assert.ok(out.includes(OSC8 + '\x1b\\'), 'should contain OSC 8 close sequence')
    assert.ok(!out.includes('[n26/terraform#40075]'), 'should strip [] markers')
    assert.ok(!out.includes(`(${url})`), 'should not show url in parentheses')
  })

  test('link — surrounding text is preserved', () => {
    const out = renderMarkdown('See [PR here](https://example.com) for details')
    assert.ok(out.includes('PR here'))
    assert.ok(out.includes('See'))
    assert.ok(out.includes('for details'))
    assert.ok(!out.includes('(https://example.com)'), 'url should not appear in parentheses')
  })

  test('link — multiple links on one line', () => {
    const out = renderMarkdown('[foo](https://a.com) and [bar](https://b.com)')
    assert.ok(out.includes('foo'))
    assert.ok(out.includes('bar'))
    assert.ok(out.includes(OSC8 + 'https://a.com'))
    assert.ok(out.includes(OSC8 + 'https://b.com'))
  })

  test('link inside fenced code block is not processed', () => {
    const out = renderMarkdown('```\n[foo](https://example.com)\n```')
    assert.ok(!out.includes(UNDERLINE), 'links inside code blocks should not be processed')
    assert.ok(out.includes('[foo](https://example.com)'), 'raw link syntax should be preserved')
  })

  test('multiline document', () => {
    const doc = [
      '# Title',
      '',
      'Some **bold** and *italic* text.',
      '',
      '- item one',
      '- item two',
      '',
      '> a note',
      '',
      '```',
      'code here',
      '```',
    ].join('\n')

    const out = renderMarkdown(doc)
    assert.ok(out.includes('•'))
    assert.ok(out.includes('│ code here'))
    assert.ok(out.includes(BOLD))
    assert.ok(out.includes(ITALIC))
  })
})
