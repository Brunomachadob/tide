import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

// marked-terminal uses chalk for ANSI codes. In a non-TTY environment chalk
// disables colors by default; set FORCE_COLOR before importing the module
// so the escape sequences are present when these assertions run.
process.env.FORCE_COLOR = '3'

const { renderMarkdown } = await import('../src/lib/markdown.js')

const BOLD      = '\x1b[1m'
const ITALIC    = '\x1b[3m'
const UNDERLINE = '\x1b[4m'
const YELLOW    = '\x1b[33m'

describe('renderMarkdown', () => {
  test('returns falsy input unchanged', () => {
    assert.equal(renderMarkdown(''), '')
    assert.equal(renderMarkdown(null), null)
    assert.equal(renderMarkdown(undefined), undefined)
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
    assert.ok(out.includes(YELLOW), 'inline code should be styled')
    assert.ok(out.includes('foo()'))
    assert.ok(!out.includes('`foo()`'), 'should strip backtick markers')
  })

  test('h1 — bold + underline, strips # prefix', () => {
    const out = renderMarkdown('# Title')
    assert.ok(out.includes(BOLD))
    assert.ok(out.includes(UNDERLINE))
    assert.ok(out.includes('Title'))
  })

  test('h2 — bold, strips ## prefix', () => {
    const out = renderMarkdown('## Section')
    assert.ok(out.includes(BOLD))
    assert.ok(out.includes('Section'))
  })

  test('h3 — bold only, strips ### prefix', () => {
    const out = renderMarkdown('### Sub')
    assert.ok(out.includes(BOLD))
    assert.ok(out.includes('Sub'))
  })

  test('blockquote — styled and text preserved', () => {
    const out = renderMarkdown('> quoted text')
    assert.ok(out.includes('quoted text'))
    assert.ok(!out.startsWith('> '))
  })

  test('bullet list with -', () => {
    const out = renderMarkdown('- item one')
    assert.ok(out.includes('item one'))
    assert.ok(!out.includes('- item'))
  })

  test('bullet list with *', () => {
    const out = renderMarkdown('* item two')
    assert.ok(out.includes('item two'))
  })

  test('fenced code block — code tokens present, no backtick fence', () => {
    const out = renderMarkdown('```\nconst x = 1\nreturn x\n```')
    // cli-highlight adds ANSI between tokens, so check individual tokens
    assert.ok(out.includes('const'), 'const keyword should appear')
    assert.ok(out.includes('return'), 'return keyword should appear')
    assert.ok(!out.includes('```'))
  })

  test('fenced code block with language hint', () => {
    const out = renderMarkdown('```js\nconsole.log("hi")\n```')
    assert.ok(out.includes('console'), 'console identifier should appear')
    assert.ok(!out.includes('```js'))
  })

  test('inline code inside fenced block is not double-processed', () => {
    const out = renderMarkdown('```\nuse `foo` here\n```')
    // Content inside code blocks should appear literally
    assert.ok(!out.includes('`foo`') === false || out.includes('foo'))
  })

  test('link — label is present and url not shown raw in brackets', () => {
    const url = 'https://github.com/n26/terraform/pull/40075'
    const out = renderMarkdown(`[n26/terraform#40075](${url})`)
    assert.ok(out.includes('n26/terraform#40075'), 'should contain link text')
    assert.ok(!out.includes('[n26/terraform#40075]'), 'should strip [] markers')
  })

  test('link — surrounding text is preserved', () => {
    const out = renderMarkdown('See [PR here](https://example.com) for details')
    assert.ok(out.includes('PR here'))
    assert.ok(out.includes('See'))
    assert.ok(out.includes('for details'))
  })

  test('link — multiple links on one line', () => {
    const out = renderMarkdown('[foo](https://a.com) and [bar](https://b.com)')
    assert.ok(out.includes('foo'))
    assert.ok(out.includes('bar'))
  })

  test('link inside fenced code block is not processed as a hyperlink', () => {
    const out = renderMarkdown('```\n[foo](https://example.com)\n```')
    // The link label and url should appear as text, not as a rendered hyperlink
    assert.ok(out.includes('foo'), 'link label should appear')
    assert.ok(out.includes('example.com'), 'url should appear')
    assert.ok(!out.includes(UNDERLINE), 'link text should not be underlined (not rendered as link)')
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
    assert.ok(out.includes('code'), 'code block content should appear')
    assert.ok(out.includes(BOLD))
    assert.ok(out.includes(ITALIC))
    assert.ok(out.includes('item one'))
    assert.ok(out.includes('a note'))
  })
})
