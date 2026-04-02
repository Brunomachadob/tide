// Render a subset of markdown to ANSI escape sequences for terminal display.
// Supports: headers, bold, italic, inline code, fenced code blocks, blockquotes, bullet lists, links.

const RESET     = '\x1b[0m'
const BOLD      = '\x1b[1m'
const DIM       = '\x1b[2m'
const ITALIC    = '\x1b[3m'
const UNDERLINE = '\x1b[4m'
const REVERSE   = '\x1b[7m'
const CYAN      = '\x1b[36m'

// Apply inline transforms to a fragment of text (no newlines, no ANSI already present)
function inlineTransforms(text) {
  // Links first — OSC 8 hyperlink, clickable in iTerm2/kitty, degrades to underlined text elsewhere
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) =>
    `\x1b]8;;${url}\x1b\\${UNDERLINE}${label}${RESET}\x1b]8;;\x1b\\`
  )
  text = text.replace(/\*\*(.+?)\*\*/g, `${BOLD}$1${RESET}`)
  text = text.replace(/\*(.+?)\*/g,     `${ITALIC}$1${RESET}`)
  text = text.replace(/`([^`]+)`/g,     `${REVERSE} $1 ${RESET}`)
  return text
}

export function renderMarkdown(text) {
  if (!text) return text

  // Extract fenced code blocks into placeholders so inline transforms don't touch them
  const codeBlocks = []
  text = text.replace(/```[^\n]*\n?([\s\S]*?)```/g, (_, code) => {
    const lines = code.replace(/\n$/, '').split('\n')
    const rendered = lines.map(l => `${DIM}│ ${l}${RESET}`).join('\n')
    codeBlocks.push(rendered)
    return `\x00CODE${codeBlocks.length - 1}\x00`
  })

  // Line-level transforms — inline transforms applied to the content portion of each line
  text = text.split('\n').map(line => {
    if (/^### /.test(line))  return `${BOLD}${inlineTransforms(line.slice(4))}${RESET}`
    if (/^## /.test(line))   return `${BOLD}${UNDERLINE}${inlineTransforms(line.slice(3))}${RESET}`
    if (/^# /.test(line))    return `${BOLD}${UNDERLINE}${inlineTransforms(line.slice(2))}${RESET}`
    if (/^> /.test(line))    return `${DIM}${CYAN}│${RESET}${DIM} ${inlineTransforms(line.slice(2))}${RESET}`
    if (/^[-*] /.test(line)) return `  • ${inlineTransforms(line.slice(2))}`
    return inlineTransforms(line)
  }).join('\n')

  // Restore code blocks
  text = text.replace(/\x00CODE(\d+)\x00/g, (_, i) => codeBlocks[parseInt(i)])

  return text
}
